"""مدل ORM لاگ حسابرسی (Audit) — مشترک بین ماژول‌ها."""
from uuid import UUID

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import INET, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from src.shared.db.base import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    actor_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action: Mapped[str] = mapped_column(String(100))
    entity: Mapped[str] = mapped_column(String(100))
    entity_id: Mapped[UUID | None] = mapped_column(nullable=True)
    diff: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    ip: Mapped[str | None] = mapped_column(INET, nullable=True)
