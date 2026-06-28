"""سرویس کوئری تماس‌ها — لیست با فیلتر و جزئیات کامل (recording/transcript/score)."""
from datetime import datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.ai_analysis.infrastructure.models import LeadScore
from src.modules.crm.infrastructure.models import Followup, Student
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
        # join با Student تا نام + پایه/رشته/هدف/معدل/شهر کنار هر تماس بیاید
        base = (
            select(Call, Student.full_name, Student.grade, Student.field,
                   Student.goal, Student.gpa, Student.city)
            .outerjoin(Student, Student.id == Call.student_id)
        )
        if direction:
            base = base.where(Call.direction == direction)
        if status:
            base = base.where(Call.status == status)

        total = await self._s.scalar(
            select(func.count()).select_from(base.subquery())
        )
        rows = (await self._s.execute(
            base.order_by(Call.started_at.desc())
            .offset((page - 1) * size)
            .limit(size)
        )).all()

        # آخرین امتیاز هر تماس
        call_ids = [r[0].id for r in rows]
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
                "outcome": c.outcome,
                "caller_number": c.caller_number,
                "callee_number": c.callee_number,
                "duration_sec": c.duration_sec,
                "started_at": c.started_at.isoformat() if c.started_at else None,
                "student_id": str(c.student_id) if c.student_id else None,
                "student_name": name,
                "grade": grade,
                "field": field,
                "goal": goal,
                "gpa": float(gpa) if gpa is not None else None,
                "city": city,
                "lead_score": scores.get(c.id),
            }
            for c, name, grade, field, goal, gpa, city in rows
        ]
        return {"items": items, "total": total or 0, "page": page, "size": size}

    async def set_outcome(self, call_id: UUID, outcome: str | None,
                          next_call_at: datetime | None, note: str | None,
                          actor_id: str) -> dict:
        """ثبت نتیجه‌ی تماس و (اختیاری) تعیین تماس بعدی.

        اگر next_call_at داده شود، یک پیگیری (followup) برای دانشجوی همان شماره
        ساخته می‌شود تا در «کارهای روز» ظاهر شود. اگر دانشجو وجود نداشت، با شماره‌ی
        تماس ساخته می‌شود.
        """
        call = await self._s.get(Call, call_id)
        if call is None:
            raise NotFoundError("تماس یافت نشد")
        if outcome:
            call.outcome = outcome

        followup_created = False
        if next_call_at is not None:
            student = None
            if call.student_id:
                student = await self._s.get(Student, call.student_id)
            if student is None and call.caller_number:
                student = await self._s.scalar(
                    select(Student).where(Student.mobile == call.caller_number,
                                          Student.deleted_at.is_(None))
                )
                if student is None:
                    student = Student(mobile=call.caller_number)
                    self._s.add(student)
                    await self._s.flush()
                call.student_id = student.id
            if student is not None:
                self._s.add(Followup(
                    student_id=student.id, owner_id=actor_id,
                    due_at=next_call_at, note=note or "تماس بعدی",
                ))
                followup_created = True

        await self._s.commit()
        return {"status": "ok", "followup_created": followup_created}

    def export_calls_query(self):
        """کوئری همه‌ی تماس‌ها (بدون صفحه‌بندی) برای خروجی استریم‌شده.

        با join به Student نام مخاطب هم می‌آید (امتیاز برای حفظ سادگی/سرعت
        استریم در این خروجی نمی‌آید — برای آن از خروجی صفحه‌ای استفاده شود)."""
        return (
            select(
                Student.full_name.label("student_name"),
                Call.caller_number,
                Call.direction,
                Call.status,
                Call.outcome,
                Call.duration_sec,
                Call.started_at,
            )
            .outerjoin(Student, Student.id == Call.student_id)
            .order_by(Call.started_at.desc())
        )

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
