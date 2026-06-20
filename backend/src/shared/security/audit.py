"""سرویس ثبت لاگ حسابرسی — ثبت هر عملیات حساس."""
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from src.shared.db.audit_model import AuditLog


async def record_audit(
    session: AsyncSession,
    *,
    actor_id: str | None,
    action: str,
    entity: str,
    entity_id: str | None = None,
    diff: dict | None = None,
    ip: str | None = None,
) -> None:
    """ثبت رویداد در audit_logs. در همان transaction سرویس فراخواننده commit می‌شود."""
    session.add(
        AuditLog(
            actor_id=UUID(actor_id) if actor_id else None,
            action=action,
            entity=entity,
            entity_id=UUID(entity_id) if entity_id else None,
            diff=diff,
            ip=ip,
        )
    )
