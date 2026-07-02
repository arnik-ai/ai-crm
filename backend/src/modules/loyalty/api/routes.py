"""Routerهای باشگاه مشتریان (زیر /api/v1/loyalty).

از مجوزهای موجودِ هسته استفاده می‌شود (`students:read`/`students:write`) تا permission
جدیدی به seedِ هسته اضافه نشود و ماژول مستقل/حذف‌شدنی بماند.
"""
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.identity.api.dependencies import require_permission
from src.modules.loyalty.application.loyalty_service import LoyaltyService
from src.modules.loyalty.application.projection import Projection
from src.shared.db.base import get_session

router = APIRouter()


@router.get("/accounts/{student_id}")
async def get_account(
    student_id: UUID,
    session: AsyncSession = Depends(get_session),
    user=Depends(require_permission("students:read")),
) -> dict:
    """پروفایلِ امتیازِ دانش‌آموز (اگر حساب نبود، ساخته می‌شود)."""
    return await LoyaltyService(session).account_profile(student_id)


@router.get("/accounts/{student_id}/transactions")
async def get_transactions(
    student_id: UUID,
    limit: int = Query(50, ge=1, le=200),
    session: AsyncSession = Depends(get_session),
    user=Depends(require_permission("students:read")),
) -> dict:
    """دفترِ امتیازِ دانش‌آموز (تاریخچه‌ی کسب/خرج)."""
    return {"items": await LoyaltyService(session).transactions(student_id, limit)}


@router.get("/leaderboard")
async def leaderboard(
    limit: int = Query(20, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
    user=Depends(require_permission("students:read")),
) -> dict:
    """رتبه‌بندیِ باارزش‌ترین‌ها بر اساسِ کلِ امتیازِ کسب‌شده."""
    return {"items": await LoyaltyService(session).leaderboard(limit)}


@router.get("/levels")
async def levels(
    session: AsyncSession = Depends(get_session),
    user=Depends(require_permission("students:read")),
) -> dict:
    """سطوح و مزایای هر سطح."""
    return {"items": await LoyaltyService(session).levels()}


@router.post("/scan")
async def scan(
    session: AsyncSession = Depends(get_session),
    user=Depends(require_permission("students:write")),
) -> dict:
    """اسکنِ فروش‌ها/تماس‌های جدید و امتیازدهی (projection). دستی/ادمین؛ بعداً Celery-beat."""
    return await Projection(session).scan()


@router.post("/events")
async def inject_event(
    body: dict,
    session: AsyncSession = Depends(get_session),
    user=Depends(require_permission("students:write")),
) -> dict:
    """تزریقِ دستیِ یک رویداد (تست/بک‌فیل). body = {type, student_id, payload, dedup_key?}."""
    return await LoyaltyService(session).process_event(body)


# ---------- فاز ۲: پاداش، مصرف، معرفی ----------
class _RedeemReq(BaseModel):
    student_id: UUID


class _ReferralReq(BaseModel):
    code: str
    student_id: UUID


@router.get("/rewards")
async def list_rewards(
    session: AsyncSession = Depends(get_session),
    user=Depends(require_permission("students:read")),
) -> dict:
    """کاتالوگِ پاداش‌های فعال."""
    return {"items": await LoyaltyService(session).rewards()}


@router.post("/rewards/{reward_id}/redeem")
async def redeem_reward(
    reward_id: UUID,
    body: _RedeemReq,
    session: AsyncSession = Depends(get_session),
    user=Depends(require_permission("students:write")),
) -> dict:
    """خرجِ امتیازِ دانش‌آموز برای یک پاداش (→ کوپن/رزرو)."""
    return await LoyaltyService(session).redeem(body.student_id, reward_id)


@router.get("/redemptions/{student_id}")
async def list_redemptions(
    student_id: UUID,
    session: AsyncSession = Depends(get_session),
    user=Depends(require_permission("students:read")),
) -> dict:
    """پاداش‌های دریافت‌شده/کوپن‌های دانش‌آموز."""
    return {"items": await LoyaltyService(session).redemptions(student_id)}


@router.post("/referrals/apply")
async def apply_referral(
    body: _ReferralReq,
    session: AsyncSession = Depends(get_session),
    user=Depends(require_permission("students:write")),
) -> dict:
    """اعمالِ کدِ معرفی برای دانش‌آموزِ جدید (معرف +۳۰۰، دوست کوپنِ ۵٪)."""
    return await LoyaltyService(session).apply_referral(body.code, body.student_id)
