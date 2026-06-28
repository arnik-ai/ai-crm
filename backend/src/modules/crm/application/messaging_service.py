"""سرویس پیام‌رسانی — ثبت/ارسال پیام (پیامک/واتساپ/تلگرام) + گزارش ارتباطات.

- پیامک: واقعاً از طریق SmsProvider ارسال می‌شود (پشت اینترفیس؛ قابل تعویض).
- واتساپ/تلگرام: ارسال از سمت کلاینت (لینک) انجام می‌شود؛ اینجا فقط ثبت می‌شود
  تا در گزارش «چه چیزی برای این شخص ارسال شده» دیده شود.
"""
from datetime import datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.crm.api.schemas import MessageCreate
from src.modules.crm.application.student_service import StudentService
from src.modules.crm.infrastructure.models import Message, Student
from src.modules.identity.infrastructure.sms.factory import get_sms_provider


class MessagingService:
    def __init__(self, session: AsyncSession):
        self._s = session

    async def create(self, body: MessageCreate, sender_id: str) -> dict:
        # اتصال به دانشجو (اگر نبود با موبایل ساخته می‌شود)
        student_id = body.student_id
        if student_id is None and body.mobile:
            student = await StudentService(self._s).find_or_create_by_mobile(body.mobile)
            student_id = student.id

        status = "sent"
        if body.channel == "sms":
            try:
                await get_sms_provider().send_text(body.mobile, body.body)
            except Exception:  # noqa: BLE001 — خطای ارسال نباید کل درخواست را بشکند
                status = "failed"

        msg = Message(
            student_id=student_id, sender_id=sender_id, mobile=body.mobile,
            channel=body.channel, body=body.body, status=status,
        )
        self._s.add(msg)
        await self._s.flush()
        await self._s.commit()
        return {"id": str(msg.id), "status": status}

    async def list(self, date_from: datetime | None, date_to: datetime | None,
                   student_id: UUID | None, page: int, size: int) -> dict:
        stmt = (
            select(Message, Student.full_name)
            .outerjoin(Student, Student.id == Message.student_id)
        )
        if date_from is not None:
            stmt = stmt.where(Message.created_at >= date_from)
        if date_to is not None:
            stmt = stmt.where(Message.created_at < date_to)
        if student_id is not None:
            stmt = stmt.where(Message.student_id == student_id)

        total = await self._s.scalar(
            select(func.count()).select_from(stmt.subquery())
        )
        rows = (await self._s.execute(
            stmt.order_by(Message.created_at.desc())
            .offset((page - 1) * size).limit(size)
        )).all()
        items = [
            {
                "id": str(m.id),
                "student_name": name,
                "mobile": m.mobile,
                "channel": m.channel,
                "body": m.body,
                "status": m.status,
                "date": m.created_at.isoformat() if m.created_at else None,
            }
            for m, name in rows
        ]
        return {"items": items, "total": total or 0, "page": page, "size": size}

    def export_query(self):
        """کوئری همه‌ی پیام‌ها برای خروجی استریم‌شده (با نام دانشجو)."""
        return (
            select(
                Student.full_name.label("student_name"),
                Message.mobile, Message.channel, Message.body,
                Message.status, Message.created_at,
            )
            .outerjoin(Student, Student.id == Message.student_id)
            .order_by(Message.created_at.desc())
        )
