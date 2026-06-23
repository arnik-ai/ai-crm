"""سرویس فروش (فیش) — ثبت و فهرست فروشِ واقعی از جدول sales."""
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.crm.api.schemas import PROGRAM_PRODUCT, SaleCreate
from src.modules.crm.infrastructure.models import Sale
from src.shared.security.audit import record_audit


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

        sale = Sale(
            student_id=body.student_id,
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
        rows = (await self._s.execute(
            stmt.offset((page - 1) * size).limit(size)
        )).scalars().all()
        return {
            "items": [self._to_dict(s) for s in rows],
            "total_amount": float(total_amount),
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
