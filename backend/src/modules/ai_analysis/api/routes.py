"""Routerهای تحلیل AI."""
from uuid import UUID

from fastapi import APIRouter, Depends

from src.modules.identity.api.dependencies import require_permission

router = APIRouter()


@router.get("/calls/{call_id}/analysis")
async def get_call_analysis(
    call_id: UUID, user=Depends(require_permission("ai:read"))
) -> dict:
    from src.modules.ai_analysis.infrastructure.repository import AnalysisRepository
    return await AnalysisRepository().get_latest_analysis(str(call_id)) or {}
