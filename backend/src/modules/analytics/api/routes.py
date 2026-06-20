"""Routerهای داشبورد و تحلیل عملکرد."""
from fastapi import APIRouter, Depends

from src.modules.identity.api.dependencies import require_permission

router = APIRouter()


@router.get("/summary")
async def summary(user=Depends(require_permission("dashboard:read"))) -> dict:
    from src.modules.analytics.application.dashboard_service import DashboardService
    return await DashboardService().summary(tenant_id=user.tenant_id)


@router.get("/funnel")
async def funnel(user=Depends(require_permission("dashboard:read"))) -> dict:
    from src.modules.analytics.application.dashboard_service import DashboardService
    return await DashboardService().funnel(tenant_id=user.tenant_id)


@router.get("/team")
async def team(user=Depends(require_permission("dashboard:read"))) -> dict:
    from src.modules.analytics.application.dashboard_service import DashboardService
    return await DashboardService().team_performance(tenant_id=user.tenant_id)


@router.get("/followups/today")
async def followups_today(user=Depends(require_permission("followups:read"))) -> dict:
    from src.modules.analytics.application.dashboard_service import DashboardService
    return await DashboardService().followups_today(owner_id=user.id)
