"""Routerهای تماس‌ها (Calls)."""
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.identity.api.dependencies import require_permission
from src.modules.telephony.application.call_query_service import CallQueryService
from src.shared.db.base import get_session
from src.shared.export.csv_stream import stream_csv_response

router = APIRouter()


class OutcomeRequest(BaseModel):
    """بدنه‌ی ثبت نتیجه‌ی تماس + (اختیاری) تعیین تماس بعدی.

    outcome یکی از: successful / unsuccessful / busy / no_answer / follow_up
    next_call_at اگر داده شود، یک پیگیری (followup) برای دانشجو ساخته می‌شود.
    """

    outcome: str | None = None
    next_call_at: datetime | None = None
    note: str | None = None


def _call_direction_label(direction: str, status: str | None) -> str:
    if status == "missed":
        return "بی‌پاسخ"
    return "ورودی" if direction == "inbound" else "خروجی"


def _call_status_label(status: str | None, outcome: str | None) -> str:
    if status == "missed":
        return "بی‌پاسخ"
    labels = {
        "successful": "موفق", "unsuccessful": "ناموفق", "busy": "مشغول/مشترک",
        "no_answer": "پاسخ نداد", "follow_up": "پیگیری",
    }
    return labels.get(outcome or "", "اقدام نشده")


@router.get("/export")
async def export_calls(
    session: AsyncSession = Depends(get_session),
    user=Depends(require_permission("calls:read")),
):
    """خروجی اکسل کاملِ همه‌ی تماس‌ها (استریم‌شده برای حجم بالا)."""
    svc = CallQueryService(session)
    return await stream_csv_response(
        session,
        svc.export_calls_query(),
        headers=["نام", "شماره", "جهت", "وضعیت تماس", "مدت (ثانیه)", "تاریخ/زمان"],
        row_mapper=lambda r: [
            r.student_name or "ناشناس",
            r.caller_number,
            _call_direction_label(r.direction, r.status),
            _call_status_label(r.status, r.outcome),
            r.duration_sec,
            r.started_at,
        ],
        filename="تماس‌ها",
    )


@router.get("")
async def list_calls(
    direction: str | None = None,
    status: str | None = None,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
    user=Depends(require_permission("calls:read")),
) -> dict:
    return await CallQueryService(session).list(direction, status, page, size)


@router.get("/{call_id}")
async def get_call(
    call_id: UUID,
    session: AsyncSession = Depends(get_session),
    user=Depends(require_permission("calls:read")),
) -> dict:
    return await CallQueryService(session).detail(call_id)


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


@router.post("/{call_id}/outcome")
async def set_call_outcome(
    call_id: UUID,
    body: OutcomeRequest,
    session: AsyncSession = Depends(get_session),
    user=Depends(require_permission("calls:write")),
) -> dict:
    """ثبت نتیجه‌ی تماس و (اختیاری) تعیین تاریخ تماس بعدی.

    اگر next_call_at داده شود، یک پیگیری برای دانشجوی همان شماره ساخته می‌شود
    تا در «کارهای روز» دیده شود.
    """
    return await CallQueryService(session).set_outcome(
        call_id, body.outcome, body.next_call_at, body.note, actor_id=user.id,
    )


@router.post("/{call_id}/reanalyze")
async def reanalyze(
    call_id: UUID, user=Depends(require_permission("ai:write"))
) -> dict:
    from app.worker import analyze_call_task
    analyze_call_task.delay(str(call_id))
    return {"status": "queued"}
