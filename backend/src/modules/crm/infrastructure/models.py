"""مدل‌های ORM ماژول CRM."""
from datetime import datetime
from uuid import UUID

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Table,
    Column,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column

from src.shared.db.base import Base

student_tags = Table(
    "student_tags", Base.metadata,
    Column("student_id", ForeignKey("students.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)


class Course(Base):
    __tablename__ = "courses"
    title: Mapped[str] = mapped_column(String(255))
    slug: Mapped[str] = mapped_column(String(255), unique=True)
    price: Mapped[float | None] = mapped_column(Numeric(12, 0), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class SalesStage(Base):
    __tablename__ = "sales_stages"
    tenant_id: Mapped[UUID | None] = mapped_column(nullable=True)
    name: Mapped[str] = mapped_column(String(100))
    order_index: Mapped[int] = mapped_column(Integer)
    is_terminal: Mapped[bool] = mapped_column(Boolean, default=False)
    color: Mapped[str] = mapped_column(String(20), default="#888888")


class Student(Base):
    __tablename__ = "students"
    tenant_id: Mapped[UUID | None] = mapped_column(nullable=True)
    full_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    mobile: Mapped[str] = mapped_column(String(20), index=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # رشته‌ی تحصیلی: تجربی / ریاضی / انسانی / سایر
    field: Mapped[str | None] = mapped_column(String(30), nullable=True)
    # پایه: tenth / eleventh / twelfth / graduate (دهم/یازدهم/دوازدهم/فارغ‌التحصیل)
    grade: Mapped[str | None] = mapped_column(String(30), nullable=True)
    goal: Mapped[str | None] = mapped_column(String(255), nullable=True)
    course_interest_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("courses.id", ondelete="SET NULL"), nullable=True)
    # منبع تماس: site / instagram / telegram / rubika / bale / sms / other
    lead_source: Mapped[str | None] = mapped_column(String(50), nullable=True)
    assigned_agent_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    sales_stage_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("sales_stages.id", ondelete="SET NULL"), nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(30), default="active", index=True)
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True)


class Tag(Base):
    __tablename__ = "tags"
    name: Mapped[str] = mapped_column(String(100), unique=True)
    color: Mapped[str] = mapped_column(String(20), default="#3b82f6")


class Note(Base):
    __tablename__ = "notes"
    student_id: Mapped[UUID] = mapped_column(
        ForeignKey("students.id", ondelete="CASCADE"), index=True)
    author_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    body: Mapped[str] = mapped_column(Text)


class Followup(Base):
    __tablename__ = "followups"
    student_id: Mapped[UUID] = mapped_column(
        ForeignKey("students.id", ondelete="CASCADE"), index=True)
    owner_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    note: Mapped[str | None] = mapped_column(Text, nullable=True)


class Activity(Base):
    __tablename__ = "activities"
    student_id: Mapped[UUID] = mapped_column(
        ForeignKey("students.id", ondelete="CASCADE"), index=True)
    type: Mapped[str] = mapped_column(String(50))
    payload: Mapped[dict | None] = mapped_column(nullable=True)


class Sale(Base):
    """فیشِ فروش — ثبت واقعی فروش با محصول، مدت برنامه و جزئیات واریز."""
    __tablename__ = "sales"
    tenant_id: Mapped[UUID | None] = mapped_column(nullable=True)
    student_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("students.id", ondelete="SET NULL"), nullable=True, index=True)
    agent_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    # نام/موبایل به‌صورت snapshot هم ذخیره می‌شوند (برای فیش مستقل از سرنخ)
    student_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    mobile: Mapped[str | None] = mapped_column(String(20), nullable=True, index=True)
    # محصول از لیست ثابت؛ برای «برنامه» مدت ماه پر می‌شود
    product: Mapped[str] = mapped_column(String(100))
    program_months: Mapped[int | None] = mapped_column(Integer, nullable=True)
    amount: Mapped[float] = mapped_column(Numeric(14, 0), default=0)
    payment_method: Mapped[str | None] = mapped_column(String(50), nullable=True)
    payment_ref: Mapped[str | None] = mapped_column(String(255), nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    sold_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    # موعد تمدید (فقط برای برنامه): sold_at + program_months — برای یادآوری فاز ۲
    renewal_due_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True)
