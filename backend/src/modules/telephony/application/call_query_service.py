"""سرویس کوئری تماس‌ها — لیست با فیلتر و جزئیات کامل (recording/transcript/score)."""
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.ai_analysis.infrastructure.models import LeadScore
from src.modules.crm.infrastructure.models import Student
from src.modules.telephony.infrastructure.models import (
    Call,
    Recording,
    Transcript,
)
from src.shared.errors.exceptions import NotFoundError


class CallQueryService:
    def __init__(self, session: AsyncSession):
        self._s = session

    async def list(self, direction, status, page, size) -> dict:
        stmt = select(Call)
        if direction:
            stmt = stmt.where(Call.direction == direction)
        if status:
            stmt = stmt.where(Call.status == status)

        total = await self._s.scalar(
            select(func.count()).select_from(stmt.subquery())
        )
        rows = (
            await self._s.execute(
                stmt.order_by(Call.started_at.desc())
                .offset((page - 1) * size)
                .limit(size)
            )
        ).scalars().all()

        # آخرین امتیاز هر تماس
        call_ids = [c.id for c in rows]
        scores: dict = {}
        if call_ids:
            score_rows = await self._s.execute(
                select(LeadScore.call_id, LeadScore.score).where(
                    LeadScore.call_id.in_(call_ids)
                )
            )
            scores = {cid: sc for cid, sc in score_rows}

        items = [
            {
                "id": str(c.id),
                "direction": c.direction,
                "status": c.status,
                "caller_number": c.caller_number,
                "callee_number": c.callee_number,
                "duration_sec": c.duration_sec,
                "started_at": c.started_at.isoformat() if c.started_at else None,
                "student_id": str(c.student_id) if c.student_id else None,
                "lead_score": scores.get(c.id),
            }
            for c in rows
        ]
        return {"items": items, "total": total or 0, "page": page, "size": size}

    async def detail(self, call_id: UUID) -> dict:
        call = await self._s.get(Call, call_id)
        if call is None:
            raise NotFoundError("تماس یافت نشد")

        rec = await self._s.scalar(
            select(Recording).where(Recording.call_id == call_id)
        )
        transcript = None
        if rec is not None:
            transcript = await self._s.scalar(
                select(Transcript).where(Transcript.recording_id == rec.id)
            )
        score = await self._s.scalar(
            select(LeadScore)
            .where(LeadScore.call_id == call_id)
            .order_by(LeadScore.created_at.desc())
            .limit(1)
        )
        student_name = None
        if call.student_id:
            student = await self._s.get(Student, call.student_id)
            student_name = student.full_name if student else None

        return {
            "id": str(call.id),
            "direction": call.direction,
            "status": call.status,
            "caller_number": call.caller_number,
            "callee_number": call.callee_number,
            "duration_sec": call.duration_sec,
            "started_at": call.started_at.isoformat() if call.started_at else None,
            "ended_at": call.ended_at.isoformat() if call.ended_at else None,
            "student_id": str(call.student_id) if call.student_id else None,
            "student_name": student_name,
            "recording": (
                {"storage_key": rec.storage_key, "status": rec.download_status}
                if rec else None
            ),
            "transcript": (
                {"content": transcript.content, "language": transcript.language}
                if transcript else None
            ),
            "analysis": (
                {
                    "lead_score": score.score,
                    "registration_probability": float(
                        score.registration_probability or 0
                    ),
                    "next_best_action": score.next_best_action,
                    "signals": score.signals,
                }
                if score else None
            ),
        }
