"""سرویس فروش (فیش) — ثبت و فهرست فروشِ واقعی از جدول sales."""
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.crm.api.schemas import PROGRAM_PRODUCT, SaleCreate, SaleUpdate
from src.modules.crm.application.student_service import StudentService
from src.modules.crm.infrastructure.models import Followup, Sale, SaleItem, Student
from src.modules.telephony.infrastructure.models import Call
from src.shared.errors.exceptions import NotFoundError
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
        # تاریخ فروش: اگر کاربر تعیین کرده همان، وگرنه اکنون
        sold_at = body.sold_at or datetime.now(tz=timezone.utc)
        if sold_at.tzinfo is None:
            sold_at = sold_at.replace(tzinfo=timezone.utc)
        # مبلغِ کلِ فیش (یک مبلغِ واریز برای کلِ محصولات)
        total = body.amount
        # خلاصه‌ی محصول/مدت برای سازگاری و نمایش
        program_item = next(
            (it for it in body.items if it.product == PROGRAM_PRODUCT), None)
        summary_product = (
            body.items[0].product if len(body.items) == 1 else "چند محصول")
        summary_months = program_item.program_months if program_item else None
        # موعد تمدید فقط اگر «برنامه» در فیش باشد (از مدتِ همان آیتم)
        renewal_due = None
        if program_item and program_item.program_months:
            renewal_due = _add_months(sold_at, program_item.program_months)

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
            product=summary_product,
            program_months=summary_months,
            amount=total,
            payment_ref=body.payment_ref,
            deposited_at=body.deposited_at,
            payer_card=body.payer_card,
            dest_account=body.dest_account,
            note=body.note,
            sold_at=sold_at,
            renewal_due_at=renewal_due,
        )
        self._s.add(sale)
        await self._s.flush()

        # آیتم‌های فیش (فقط محصول/مدت؛ مبلغ روی کلِ فیش است)
        for it in body.items:
            self._s.add(SaleItem(
                sale_id=sale.id, product=it.product,
                program_months=it.program_months, amount=0,
            ))

        # تماس پیگیری خودکار چند روز پس از خرید → در «کارهای روز» دیده می‌شود
        if student_id is not None:
            self._s.add(Followup(
                student_id=student_id, owner_id=agent_id,
                due_at=sold_at + timedelta(days=FOLLOWUP_DAYS_AFTER_SALE),
                note=f"پیگیری پس از خرید ({summary_product})",
            ))

        await record_audit(self._s, actor_id=agent_id, action="create",
                           entity="sale", entity_id=str(sale.id),
                           diff={"product": summary_product, "amount": total})
        await self._s.commit()
        result = self._to_dict(sale)
        result["items"] = [
            {"product": it.product, "program_months": it.program_months, "amount": 0.0}
            for it in body.items
        ]
        return result

    async def update_sale(self, sale_id, body: SaleUpdate, actor_id: str) -> dict:
        """ویرایشِ فیش — فیلدهای ارسال‌شده به‌روزرسانی می‌شوند؛ اگر items بیاید،
        آیتم‌های قبلی جایگزین و خلاصه/موعدِ تمدید بازمحاسبه می‌شوند."""
        sale = await self._s.get(Sale, sale_id)
        if sale is None:
            raise NotFoundError("فیش یافت نشد")
        data = body.model_dump(exclude_unset=True)
        items = data.pop("items", None)
        # تاریخِ فروش برای بازمحاسبه‌ی موعدِ تمدید
        sold_at = data.get("sold_at") or sale.sold_at
        if sold_at is not None and sold_at.tzinfo is None:
            sold_at = sold_at.replace(tzinfo=timezone.utc)
        for k, v in data.items():
            setattr(sale, k, v)
        if items is not None:
            await self._s.execute(delete(SaleItem).where(SaleItem.sale_id == sale.id))
            program_item = next(
                (it for it in items if it["product"] == PROGRAM_PRODUCT), None)
            sale.product = items[0]["product"] if len(items) == 1 else "چند محصول"
            sale.program_months = program_item["program_months"] if program_item else None
            sale.renewal_due_at = (
                _add_months(sold_at, program_item["program_months"])
                if program_item and program_item.get("program_months") else None
            )
            for it in items:
                self._s.add(SaleItem(
                    sale_id=sale.id, product=it["product"],
                    program_months=it.get("program_months"), amount=0,
                ))
        await record_audit(self._s, actor_id=actor_id, action="update",
                           entity="sale", entity_id=str(sale.id), diff=data)
        await self._s.commit()
        return self._to_dict(sale)

    async def delete_sale(self, sale_id, actor_id: str) -> dict:
        """حذفِ فیش (آیتم‌هایش با CASCADE پاک می‌شوند)."""
        sale = await self._s.get(Sale, sale_id)
        if sale is None:
            raise NotFoundError("فیش یافت نشد")
        await record_audit(self._s, actor_id=actor_id, action="delete",
                           entity="sale", entity_id=str(sale_id))
        await self._s.delete(sale)
        await self._s.commit()
        return {"status": "deleted"}

    async def list_sales(self, page: int, size: int) -> dict:
        stmt = select(Sale).order_by(Sale.sold_at.desc())
        total_count = await self._s.scalar(
            select(func.count()).select_from(stmt.subquery())
        ) or 0
        total_amount = await self._s.scalar(
            select(func.coalesce(func.sum(Sale.amount), 0))
        ) or 0
        # جمع تفکیکی در سطحِ فیش (یک مبلغِ کل): اگر فیش شاملِ «برنامه» باشد →
        # جمعِ «برنامه»؛ وگرنه → «دوره». (مبلغ روی کلِ فیش است، نه تک‌تکِ محصولات.)
        has_program = (
            select(SaleItem.id)
            .where(SaleItem.sale_id == Sale.id,
                   SaleItem.product == PROGRAM_PRODUCT)
            .exists()
        )
        total_program = await self._s.scalar(
            select(func.coalesce(func.sum(Sale.amount), 0)).where(has_program)
        ) or 0
        total_other = await self._s.scalar(
            select(func.coalesce(func.sum(Sale.amount), 0)).where(~has_program)
        ) or 0
        rows = (await self._s.execute(
            stmt.offset((page - 1) * size).limit(size)
        )).scalars().all()

        # آیتم‌های همین صفحه را یک‌جا می‌گیریم (نه N کوئری)
        sale_ids = [s.id for s in rows]
        items_by_sale: dict = {}
        if sale_ids:
            item_rows = (await self._s.execute(
                select(SaleItem.sale_id, SaleItem.product,
                       SaleItem.program_months, SaleItem.amount)
                .where(SaleItem.sale_id.in_(sale_ids))
            )).all()
            for sid, product, months, amount in item_rows:
                items_by_sale.setdefault(sid, []).append({
                    "product": product, "program_months": months,
                    "amount": float(amount) if amount is not None else 0.0,
                })

        out_items = []
        for s in rows:
            d = self._to_dict(s)
            d["items"] = items_by_sale.get(s.id, [])
            out_items.append(d)
        return {
            "items": out_items,
            "total_amount": float(total_amount),
            "total_program": float(total_program),
            "total_other": float(total_other),
            "count": total_count,
            "page": page,
            "size": size,
        }

    def export_sales_query(self):
        """کوئری همه‌ی فروش‌ها برای خروجی استریم‌شده (سطحِ فیش؛ مبلغ = جمع آیتم‌ها)."""
        return select(
            Sale.student_name, Sale.mobile, Sale.sold_at, Sale.product,
            Sale.program_months, Sale.amount, Sale.payer_card,
            Sale.dest_account, Sale.payment_ref,
        ).order_by(Sale.sold_at.desc())

    async def purchase_timeline(self, page: int = 1, size: int = 50) -> dict:
        """تایم‌لاینِ ورود→تماس→خرید برای هر فروش (صفحه‌بندی‌شده).

        برای هر فیش: تاریخ ورودِ شماره، اولین تماس، تاریخ خرید، تعداد تماس تا خرید
        و فاصله‌ی روز (از ورود و از اولین تماس تا خرید).
        """
        total = await self._s.scalar(
            select(func.count(Sale.id)).where(Sale.student_id.is_not(None))
        ) or 0
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
            .offset((page - 1) * size).limit(size)
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
        return {"items": items, "total": total, "page": page, "size": size}

    async def repeat_customers(self, min_purchases: int = 2,
                               page: int = 1, size: int = 50) -> dict:
        """گزارش مشتریانِ چندبارخرید (صفحه‌بندی‌شده): هر مشتری چند فروش داشته، در چه
        تاریخ‌هایی و با چه فاصله‌ی روزی بین خریدها.

        گروه‌بندی بر اساس موبایلِ فیش. فقط مشتریانی که ≥ min_purchases خرید دارند.
        """
        # موبایل‌هایی که ≥ min_purchases خرید دارند (پایه‌ی شمارش و صفحه‌بندی)
        grouped = (
            select(Sale.mobile, func.count(Sale.id).label("cnt"))
            .where(Sale.mobile.is_not(None))
            .group_by(Sale.mobile)
            .having(func.count(Sale.id) >= min_purchases)
        )
        total = await self._s.scalar(
            select(func.count()).select_from(grouped.subquery())
        ) or 0
        mobiles = (await self._s.execute(
            grouped.order_by(func.count(Sale.id).desc())
            .offset((page - 1) * size).limit(size)
        )).all()

        items = []
        for mobile, cnt in mobiles:
            sales = (await self._s.execute(
                select(Sale.student_name, Sale.product, Sale.amount, Sale.sold_at)
                .where(Sale.mobile == mobile)
                .order_by(Sale.sold_at.asc())
            )).all()
            purchases = []
            prev_date = None
            for s in sales:
                gap = (s.sold_at - prev_date).days if prev_date and s.sold_at else None
                purchases.append({
                    "product": s.product,
                    "amount": float(s.amount) if s.amount is not None else 0.0,
                    "sold_at": s.sold_at.isoformat() if s.sold_at else None,
                    "days_since_prev": gap,
                })
                prev_date = s.sold_at
            name = next((s.student_name for s in sales if s.student_name), None)
            cust_total = sum(p["amount"] for p in purchases)
            items.append({
                "mobile": mobile,
                "student_name": name,
                "count": int(cnt),
                "total_amount": cust_total,
                "purchases": purchases,
            })
        return {"items": items, "total": total, "page": page, "size": size}

    @staticmethod
    def _to_dict(s: Sale) -> dict:
        return {
            "id": str(s.id),
            "student_name": s.student_name,
            "mobile": s.mobile,
            "product": s.product,
            "program_months": s.program_months,
            "amount": float(s.amount) if s.amount is not None else 0.0,
            "items": [],
            "payment_ref": s.payment_ref,
            "deposited_at": s.deposited_at.isoformat() if s.deposited_at else None,
            "payer_card": s.payer_card,
            "dest_account": s.dest_account,
            "date": s.sold_at.isoformat() if s.sold_at else None,
            "renewal_due": s.renewal_due_at.isoformat() if s.renewal_due_at else None,
        }
