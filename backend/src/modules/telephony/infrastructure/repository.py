"""Repositoryهای تلفنی — دسترسی به DB برای تماس‌ها و لاگ Webhook.

نکته: این کلاس‌ها برای استفاده در context سنکرون Celery، Sessionهای خودشان را می‌سازند.
متدها به‌صورت اسکلت با امضای نهایی پیاده‌سازی شده‌اند.
"""
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert

from src.modules.telephony.domain.events import TelephonyEvent
from src.modules.telephony.infrastructure.models import Call, WebhookLog
from src.shared.db.base import SessionLocal


class WebhookLogRepository:
    async def upsert(self, event: TelephonyEvent) -> tuple[str, bool]:
        """ثبت لاگ با Idempotency؛ برمی‌گرداند (log_id, is_duplicate)."""
        async with SessionLocal() as s:
            stmt = (
                insert(WebhookLog)
                .values(
                    id=uuid4(), provider=event.provider, event_type=event.event_type,
                    external_id=event.external_call_id, payload=event.raw,
                    signature_valid=True, process_status="received",
                )
                .on_conflict_do_nothing(
                    index_elements=["provider", "event_type", "external_id"]
                )
                .returning(WebhookLog.id)
            )
            res = await s.execute(stmt)
            row = res.scalar_one_or_none()
            await s.commit()
            if row is None:
                existing = await s.scalar(
                    select(WebhookLog.id).where(
                        WebhookLog.provider == event.provider,
                        WebhookLog.event_type == event.event_type,
                        WebhookLog.external_id == event.external_call_id,
                    )
                )
                return str(existing), True
            return str(row), False

    async def get_event(self, log_id: str) -> TelephonyEvent | None:
        async with SessionLocal() as s:
            log = await s.get(WebhookLog, UUID(log_id))
            if log is None:
                return None
            from src.modules.telephony.infrastructure.factory import (
                get_telephony_provider,
            )
            return get_telephony_provider().parse_event(log.payload)

    async def mark_done(self, log_id: str) -> None:
        async with SessionLocal() as s:
            log = await s.get(WebhookLog, UUID(log_id))
            if log:
                log.process_status = "done"
                await s.commit()


class CallRepository:
    async def match_or_create_student(self, mobile: str) -> str | None:
        from src.modules.crm.infrastructure.models import Student
        async with SessionLocal() as s:
            student = await s.scalar(select(Student).where(Student.mobile == mobile))
            if student:
                return str(student.id)
            new = Student(mobile=mobile, lead_source="تماس تلفنی", status="active")
            s.add(new)
            await s.commit()
            return str(new.id)

    async def upsert_call(self, event: TelephonyEvent, student_id: str | None) -> str:
        async with SessionLocal() as s:
            existing = await s.scalar(
                select(Call).where(Call.provider == event.provider,
                                   Call.external_id == event.external_call_id)
            )
            status_map = {"incoming": "answered", "outgoing": "answered",
                          "missed": "missed", "finished": "finished",
                          "recording_ready": "finished"}
            if existing:
                existing.status = status_map.get(event.event_type, existing.status)
                existing.duration_sec = event.duration_sec or existing.duration_sec
                existing.ended_at = event.ended_at or existing.ended_at
                existing.recording_url = event.recording_url or existing.recording_url
                await s.commit()
                return str(existing.id)
            call = Call(
                student_id=UUID(student_id) if student_id else None,
                provider=event.provider, external_id=event.external_call_id,
                direction=event.direction, status=status_map.get(event.event_type, "finished"),
                caller_number=event.caller_number, callee_number=event.callee_number,
                duration_sec=event.duration_sec or 0, recording_url=event.recording_url,
                started_at=event.started_at, ended_at=event.ended_at,
            )
            s.add(call)
            await s.commit()
            return str(call.id)

    async def add_activity(self, student_id: str | None, event: TelephonyEvent) -> None:
        if not student_id:
            return
        from src.modules.crm.infrastructure.models import Activity
        async with SessionLocal() as s:
            s.add(Activity(student_id=UUID(student_id), type=f"call_{event.event_type}",
                          payload={"external_id": event.external_call_id}))
            await s.commit()
