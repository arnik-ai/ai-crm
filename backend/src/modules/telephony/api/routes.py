"""Routerهای تماس‌ها (Calls)."""
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from src.modules.identity.api.dependencies import require_permission

router = APIRouter()


@router.get("")
async def list_calls(
    direction: str | None = None,
    status: str | None = None,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    user=Depends(require_permission("calls:read")),
) -> dict:
    # پیاده‌سازی با CallQueryService
    return {"items": [], "total": 0, "page": page, "size": size}


@router.get("/{call_id}")
async def get_call(call_id: UUID, user=Depends(require_permission("calls:read"))) -> dict:
    return {"id": str(call_id)}


@router.get("/{call_id}/recording")
async def get_recording_url(
    call_id: UUID, user=Depends(require_permission("calls:read"))
) -> dict:
    """URL امضاشده‌ی کوتاه‌عمر برای پخش فایل."""
    from src.modules.ai_analysis.infrastructure.repository import AnalysisRepository
    from src.shared.storage.s3 import S3Storage

    rec = await AnalysisRepository().get_recording(str(call_id))
    if not rec:
        return {"url": None}
    url = await S3Storage().presigned_url(rec["storage_key"])
    return {"url": url}


@router.post("/{call_id}/reanalyze")
async def reanalyze(
    call_id: UUID, user=Depends(require_permission("ai:write"))
) -> dict:
    from app.worker import analyze_call_task
    analyze_call_task.delay(str(call_id))
    return {"status": "queued"}
