"""Repository دستیار — کوئری‌های پارامتری امن برای intentها (بدون SQL خام)."""
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from src.modules.ai_analysis.infrastructure.models import LeadScore
from src.modules.crm.infrastructure.models import Followup, Student
from src.shared.db.base import SessionLocal


def _serialize(student: Student) -> dict:
    return {"id": str(student.id), "full_name": student.full_name,
            "mobile": student.mobile, "status": student.status}


class AssistantRepository:
    async def followups_due_today(self, agent_id: str) -> list[dict]:
        start = datetime.now(tz=timezone.utc).replace(hour=0, minute=0, second=0)
        end = start + timedelta(days=1)
        async with SessionLocal() as s:
            rows = (await s.execute(
                select(Student).join(Followup, Followup.student_id == Student.id)
                .where(Followup.due_at >= start, Followup.due_at < end,
                       Followup.status == "pending")
            )).scalars().all()
            return [_serialize(r) for r in rows]

    async def high_probability(self, threshold: float) -> list[dict]:
        async with SessionLocal() as s:
            rows = (await s.execute(
                select(Student, LeadScore.registration_probability)
                .join(LeadScore, LeadScore.student_id == Student.id)
                .where(LeadScore.registration_probability >= threshold)
            )).all()
            return [{**_serialize(st), "registration_probability": float(p or 0)}
                    for st, p in rows]

    async def interested_in(self, course_name: str) -> list[dict]:
        # تطبیق بر اساس signals.course_name در lead_scores (JSONB)
        async with SessionLocal() as s:
            rows = (await s.execute(
                select(Student, LeadScore.signals)
                .join(LeadScore, LeadScore.student_id == Student.id)
            )).all()
            return [_serialize(st) for st, sig in rows
                    if sig and course_name in str(sig.get("course_name", ""))]

    async def with_price_objection(self) -> list[dict]:
        async with SessionLocal() as s:
            rows = (await s.execute(
                select(Student, LeadScore.signals)
                .join(LeadScore, LeadScore.student_id == Student.id)
            )).all()
            return [_serialize(st) for st, sig in rows
                    if sig and sig.get("budget_concern")]

    async def no_followup_since(self, days: int) -> list[dict]:
        cutoff = datetime.now(tz=timezone.utc) - timedelta(days=days)
        async with SessionLocal() as s:
            # سرنخ‌هایی که آخرین فعالیت/پیگیری‌شان قدیمی‌تر از cutoff است
            rows = (await s.execute(
                select(Student).where(Student.updated_at < cutoff,
                                      Student.status == "active")
            )).scalars().all()
            return [_serialize(r) for r in rows]
