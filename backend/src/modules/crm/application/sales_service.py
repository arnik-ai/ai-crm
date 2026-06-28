"""سرویس فروش (فیش) — ثبت و فهرست فروشِ واقعی از جدول sales."""
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.crm.api.schemas import PROGRAM_PRODUCT, SaleCreate
from src.modules.crm.application.student_service import StudentService
from src.modules.crm.infrastructure.models import Followup, Sale, Student
from src.modules.telephony.infrastructure.models import Call
from src.shared.security.audit import record_audit

# چند روز پس از خرید، یک تماس پیگیری خودکار برای مشتری ساخته می‌شود.
FOLLOWUP_DAYS_AFTER_SALE = 5


def _add_months(dt: datetime, months: int) -> datetime:
    """افزودن n ماه (میلادی) با مدیریت سرریز سال و طول ماه."""
    m = dt.month - 1 + months
    year = dt.year + m // 12
    month = m % 12 + 1
    # روزِ معتبر در ماه مقصد
    if month == 12:
        next_month_first = datetime(year + 1, 1, 1, tzinfo=dt.tzinfo)
    else:
        next_month_first = datetime(year, month + 1, 1, tzinfo=dt.tzinfo)
    from datetime import timedelta
    last_day = (next_month_first - timedelta(days=1)).day
    day = min(dt.day, last_day)
    return dt.replace(year=year, month=month, day=day)


class SalesService:
    def __init__(self, session: AsyncSession):
        self._s = session

    async def create_sale(self, body: SaleCreate, agent_id: str) -> dict:
        sold_at = datetime.now(tz=timezone.utc)
        renewal_due = None
        if body.product == PROGRAM_PRODUCT and body.program_months:
            renewal_due = _add_months(sold_at, body.program_months)

        # فیش را به دانشجو وصل می‌کنیم (اگر نبود، با موبایل ساخته می‌شود)
        student_id = body.student_id
        if student_id is None and body.mobile:
            student = await StudentService(self._s).find_or_create_by_mobile(
                body.mobile, full_name=body.student_name)
            student_id = student.id

        sale = Sale(
            student_id=student_id,
            agent_id=agent_id,
            student_name=body.student_name,
            mobile=body.mobile,
            product=body.product,
            program_months=body.program_months,
            amount=body.amount,
            payment_method=body.payment_method,
            payment_ref=body.payment_ref,
            note=body.note,
            sold_at=sold_at,
            renewal_due_at=renewal_due,
        )
        self._s.add(sale)
        await self._s.flush()

        # تماس پیگیری خودکار چند روز پس از خرید → در «کارهای روز» دیده می‌شود
        if student_id is not None:
            self._s.add(Followup(
                student_id=student_id, owner_id=agent_id,
                due_at=sold_at + timedelta(days=FOLLOWUP_DAYS_AFTER_SALE),
                note=f"پیگیری پس از خرید ({body.product})",
            ))

        await record_audit(self._s, actor_id=agent_id, action="create",
                           entity="sale", entity_id=str(sale.id),
                           diff={"product": body.product, "amount": body.amount})
        await self._s.commit()
        return self._to_dict(sale)

    async def list_sales(self, page: int, size: int) -> dict:
        stmt = select(Sale).order_by(Sale.sold_at.desc())
        total_count = await self._s.scalar(
            select(func.count()).select_from(stmt.subquery())
        ) or 0
        total_amount = await self._s.scalar(
            select(func.coalesce(func.sum(Sale.amount), 0))
        ) or 0
        # جمع تفکیکی: «برنامه»ها باهم، بقیه‌ی محصولات جدا (درخواست کارفرما)
        total_program = await self._s.scalar(
            select(func.coalesce(func.sum(Sale.amount), 0))
            .where(Sale.product == PROGRAM_PRODUCT)
        ) or 0
        total_other = await self._s.scalar(
            select(func.coalesce(func.sum(Sale.amount), 0))
            .where(Sale.product != PROGRAM_PRODUCT)
        ) or 0
        rows = (await self._s.execute(
            stmt.offset((page - 1) * size).limit(size)
        )).scalars().all()
        return {
            "items": [self._to_dict(s) for s in rows],
            "total_amount": float(total_amount),
            "total_program": float(total_program),
            "total_other": float(total_other),
            "count": total_count,
            "page": page,
            "size": size,
        }

    def export_sales_query(self):
        """کوئری همه‌ی فروش‌ها برای خروجی استریم‌شده."""
        return select(
            Sale.student_name, Sale.mobile, Sale.sold_at, Sale.product,
            Sale.program_months, Sale.amount, Sale.payment_method, Sale.payment_ref,
        ).order_by(Sale.sold_at.desc())

    async def purchase_timeline(self, limit: int = 100) -> dict:
        """تایم‌لاینِ ورود→تماس→خرید برای هر فروش.

        برای هر فیش: تاریخ ورودِ شماره، اولین تماس، تاریخ خرید، تعداد تماس تا خرید
        و فاصله‌ی روز (از ورود و از اولین تماس تا خرید).
        """
        calls_count = (
            select(func.count(Call.id))
            .where(Call.student_id == Sale.student_id,
                   Call.started_at <= Sale.sold_at)
            .correlate(Sale).scalar_subquery()
        )
        first_call = (
            select(func.min(Call.started_at))
            .where(Call.student_id == Sale.student_id,
                   Call.started_at <= Sale.sold_at)
            .correlate(Sale).scalar_subquery()
        )
        rows = (await self._s.execute(
            select(
                Sale.id, Sale.student_name, Sale.mobile, Sale.product, Sale.sold_at,
                Student.created_at.label("arrived"),
                calls_count.label("calls"),
                first_call.label("first_call"),
            )
            .outerjoin(Student, Student.id == Sale.student_id)
            .where(Sale.student_id.is_not(None))
            .order_by(Sale.sold_at.desc())
            .limit(limit)
        )).all()

        items = []
        for r in rows:
            days_total = (r.sold_at - r.arrived).days if r.arrived and r.sold_at else None
            days_from_first = (
                (r.sold_at - r.first_call).days if r.first_call and r.sold_at else None
            )
            items.append({
                "id": str(r.id),
                "student_name": r.student_name,
                "mobile": r.mobile,
                "product": r.product,
                "arrived_at": r.arrived.isoformat() if r.arrived else None,
                "first_call_at": r.first_call.isoformat() if r.first_call else None,
                "sold_at": r.sold_at.isoformat() if r.sold_at else None,
                "calls_to_purchase": int(r.calls or 0),
                "days_to_purchase": days_total,
                "days_from_first_call": days_from_first,
            })
        return {"items": items}

    @staticmethod
    def _to_dict(s: Sale) -> dict:
        return {
            "id": str(s.id),
            "student_name": s.student_name,
            "mobile": s.mobile,
            "product": s.product,
            "program_months": s.program_months,
            "amount": float(s.amount) if s.amount is not None else 0.0,
            "payment": s.payment_method,
            "payment_ref": s.payment_ref,
            "date": s.sold_at.isoformat() if s.sold_at else None,
            "renewal_due": s.renewal_due_at.isoformat() if s.renewal_due_at else None,
        }
