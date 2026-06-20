"""مدل‌های ORM ماژول تلفنی — تماس، ضبط، لاگ Webhook."""
from datetime import datetime
from uuid import UUID

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from src.shared.db.base import Base


class Call(Base):
    __tablename__ = "calls"
    __table_args__ = (UniqueConstraint("provider", "external_id",
                                       name="uq_call_external"),)

    tenant_id: Mapped[UUID | None] = mapped_column(nullable=True)
    student_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("students.id", ondelete="SET NULL"), nullable=True, index=True)
    agent_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    provider: Mapped[str] = mapped_column(String(50), default="workano")
    external_id: Mapped[str] = mapped_column(String(255))
    direction: Mapped[str] = mapped_column(String(20))
    status: Mapped[str] = mapped_column(String(20))
    caller_number: Mapped[str | None] = mapped_column(String(20), nullable=True)
    callee_number: Mapped[str | None] = mapped_column(String(20), nullable=True)
    duration_sec: Mapped[int] = mapped_column(Integer, default=0)
    recording_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True)
    ended_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True)


class Recording(Base):
    __tablename__ = "recordings"
    call_id: Mapped[UUID] = mapped_column(
        ForeignKey("calls.id", ondelete="CASCADE"), unique=True)
    storage_key: Mapped[str | None] = mapped_column(String(500), nullable=True)
    format: Mapped[str] = mapped_column(String(10), default="mp3")
    size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    download_status: Mapped[str] = mapped_column(String(20), default="pending")


class Transcript(Base):
    __tablename__ = "transcripts"
    recording_id: Mapped[UUID] = mapped_column(
        ForeignKey("recordings.id", ondelete="CASCADE"), unique=True)
    language: Mapped[str] = mapped_column(String(10), default="fa")
    content: Mapped[str | None] = mapped_column(String, nullable=True)
    segments: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    engine: Mapped[str] = mapped_column(String(50), default="avalai-whisper")


class WebhookLog(Base):
    __tablename__ = "webhook_logs"
    __table_args__ = (UniqueConstraint("provider", "event_type", "external_id",
                                       name="uq_webhook_event"),)

    provider: Mapped[str] = mapped_column(String(50))
    event_type: Mapped[str] = mapped_column(String(50))
    external_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    payload: Mapped[dict] = mapped_column(JSONB)
    signature_valid: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    process_status: Mapped[str] = mapped_column(String(20), default="received")
