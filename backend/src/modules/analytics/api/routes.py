"""Routerهای داشبورد و تحلیل عملکرد."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.analytics.application.dashboard_service import DashboardService
from src.modules.identity.api.dependencies import require_permission
from src.shared.cache.json_cache import cached_json
from src.shared.db.base import get_session

router = APIRouter()

# عمر کش (ثانیه) — داشبورد آمارِ تجمیعی است؛ تأخیر چند ثانیه‌ای پذیرفتنی است
# و بار دیتابیس را زیر ترافیک بالا چند برابر کم می‌کند.
CACHE_TTL = 30
CACHE_TTL_LONG = 60


@router.get("/summary")
async def summary(
    session: AsyncSession = Depends(get_session),
    user=Depends(require_permission("dashboard:read")),
) -> dict:
    return await cached_json(
        f"dash:summary:{user.tenant_id}", CACHE_TTL,
        lambda: DashboardService(session).summary(tenant_id=user.tenant_id),
    )


@router.get("/funnel")
async def funnel(
    session: AsyncSession = Depends(get_session),
    user=Depends(require_permission("dashboard:read")),
) -> dict:
    return await cached_json(
        f"dash:funnel:{user.tenant_id}", CACHE_TTL,
        lambda: DashboardService(session).funnel(tenant_id=user.tenant_id),
    )


@router.get("/team")
async def team(
    session: AsyncSession = Depends(get_session),
    user=Depends(require_permission("dashboard:read")),
) -> dict:
    return await cached_json(
        f"dash:team:{user.tenant_id}", CACHE_TTL,
        lambda: DashboardService(session).team_performance(tenant_id=user.tenant_id),
    )


@router.get("/calls-trend")
async def calls_trend(
    days: int = 7,
    session: AsyncSession = Depends(get_session),
    user=Depends(require_permission("dashboard:read")),
) -> dict:
    return await cached_json(
        f"dash:trend:{user.tenant_id}:{days}", CACHE_TTL,
        lambda: DashboardService(session).calls_trend(tenant_id=user.tenant_id, days=days),
    )


@router.get("/followups/today")
async def followups_today(
    session: AsyncSession = Depends(get_session),
    user=Depends(require_permission("followups:read")),
) -> dict:
    return await DashboardService(session).followups_today(owner_id=user.id)


@router.get("/daily-report")
async def daily_report(
    date: str | None = None,
    session: AsyncSession = Depends(get_session),
    user=Depends(require_permission("dashboard:read")),
) -> dict:
    """گزارش روزانه‌ی تماس. date به فرمت YYYY-MM-DD؛ پیش‌فرض امروز."""
    target = (
        datetime.fromisoformat(date).replace(tzinfo=timezone.utc)
        if date
        else datetime.now(tz=timezone.utc)
    )
    day_key = target.date().isoformat()
    return await cached_json(
        f"dash:daily-report:{user.tenant_id}:{day_key}", CACHE_TTL,
        lambda: DashboardService(session).daily_report(
            tenant_id=user.tenant_id, target_day=target
        ),
    )


@router.get("/daily-performance")
async def daily_performance(
    days: int = 14,
    session: AsyncSession = Depends(get_session),
    user=Depends(require_permission("dashboard:read")),
) -> dict:
    """جدول عملکرد روز — هر ردیف یک روز در N روز اخیر."""
    return await cached_json(
        f"dash:daily-perf:{user.tenant_id}:{days}", CACHE_TTL_LONG,
        lambda: DashboardService(session).daily_performance(
            tenant_id=user.tenant_id, days=days
        ),
    )


@router.get("/monthly-performance")
async def monthly_performance(
    months: int = 6,
    session: AsyncSession = Depends(get_session),
    user=Depends(require_permission("dashboard:read")),
) -> dict:
    """پنل عملکرد نیرو در طول ماه — امتیاز و سطح هر کارشناس به تفکیک ماه."""
    return await cached_json(
        f"dash:monthly-perf:{user.tenant_id}:{months}", CACHE_TTL_LONG,
        lambda: DashboardService(session).monthly_performance(
            tenant_id=user.tenant_id, months=months
        ),
    )
