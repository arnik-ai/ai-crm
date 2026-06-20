"""مدل ORM امتیاز سرنخ."""
from uuid import UUID

from sqlalchemy import ForeignKey, Integer, Numeric, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from src.shared.db.base import Base


class LeadScore(Base):
    __tablename__ = "lead_scores"
    student_id: Mapped[UUID] = mapped_column(
        ForeignKey("students.id", ondelete="CASCADE"), index=True)
    call_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("calls.id", ondelete="SET NULL"), nullable=True)
    score: Mapped[int] = mapped_column(Integer)
    registration_probability: Mapped[float | None] = mapped_column(
        Numeric(4, 3), nullable=True)
    signals: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    next_best_action: Mapped[str | None] = mapped_column(String, nullable=True)
