"""سرویس اقساطِ برنامه — افزودن/فهرست/تیکِ پرداختِ هر قسط.

مثل شیتِ اکسلِ کارفرما: هر ردیف یک پلنِ اقساط است؛ پرداختِ هر قسط با کلیک
روی خانه‌ی ماه (toggle) در آرایه‌ی `paid` ثبت/برداشته می‌شود.
"""
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.crm.api.schemas import InstallmentCreate
from src.modules.crm.infrastructure.models import InstallmentPlan
from src.shared.errors.exceptions import NotFoundError


class InstallmentService:
    def __init__(self, session: AsyncSession):
        self._s = session

    async def create(self, body: InstallmentCreate) -> dict:
        plan = InstallmentPlan(
            student_name=body.student_name,
            mobile=body.mobile,
            advisor=body.advisor,
            amount=body.amount,
            count=body.count,
            installment_amount=body.installment_amount,
            start_month=body.start_month,
            paid=[],
            note=body.note,
        )
        self._s.add(plan)
        await self._s.flush()
        await self._s.commit()
        return self._to_dict(plan)

    async def list(self) -> dict:
        rows = (await self._s.execute(
            select(InstallmentPlan).order_by(InstallmentPlan.created_at.desc())
        )).scalars().all()
        return {"items": [self._to_dict(p) for p in rows]}

    async def toggle(self, plan_id: UUID, n: int) -> dict:
        """تیک/برداشتِ قسطِ شماره‌ی n (۱-مبنا)."""
        plan = await self._s.get(InstallmentPlan, plan_id)
        if plan is None:
            raise NotFoundError("پلن اقساط یافت نشد")
        paid = set(plan.paid or [])
        if n in paid:
            paid.discard(n)
        else:
            paid.add(n)
        # لیستِ مرتب برای نمایشِ پایدار
        plan.paid = sorted(paid)
        await self._s.commit()
        return self._to_dict(plan)

    async def delete(self, plan_id: UUID) -> dict:
        plan = await self._s.get(InstallmentPlan, plan_id)
        if plan is None:
            raise NotFoundError("پلن اقساط یافت نشد")
        await self._s.delete(plan)
        await self._s.commit()
        return {"status": "deleted"}

    @staticmethod
    def _to_dict(p: InstallmentPlan) -> dict:
        return {
            "id": str(p.id),
            "student_name": p.student_name,
            "mobile": p.mobile,
            "advisor": p.advisor,
            "amount": float(p.amount) if p.amount is not None else 0.0,
            "count": p.count,
            "installment_amount": (
                float(p.installment_amount) if p.installment_amount is not None else 0.0
            ),
            "start_month": p.start_month,
            "paid": p.paid or [],
            "note": p.note,
        }
