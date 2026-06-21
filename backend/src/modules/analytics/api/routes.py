"""Routerهای داشبورد و تحلیل عملکرد."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.analytics.application.dashboard_service import DashboardService
from src.modules.identity.api.dependencies import require_permission
from src.shared.db.base import get_session

router = APIRouter()


@router.get("/summary")
async def summary(
    session: AsyncSession = Depends(get_session),
    user=Depends(require_permission("dashboard:read")),
) -> dict:
    return await DashboardService(session).summary(tenant_id=user.tenant_id)


@router.get("/funnel")
async def funnel(
    session: AsyncSession = Depends(get_session),
    user=Depends(require_permission("dashboard:read")),
) -> dict:
    return await DashboardService(session).funnel(tenant_id=user.tenant_id)


@router.get("/team")
async def team(
    session: AsyncSession = Depends(get_session),
    user=Depends(require_permission("dashboard:read")),
) -> dict:
    return await DashboardService(session).team_performance(tenant_id=user.tenant_id)


@router.get("/calls-trend")
async def calls_trend(
    days: int = 7,
    session: AsyncSession = Depends(get_session),
    user=Depends(require_permission("dashboard:read")),
) -> dict:
    return await DashboardService(session).calls_trend(tenant_id=user.tenant_id, days=days)


@router.get("/followups/today")
async def followups_today(
    session: AsyncSession = Depends(get_session),
    user=Depends(require_permission("followups:read")),
) -> dict:
    return await DashboardService(session).followups_today(owner_id=user.id)
