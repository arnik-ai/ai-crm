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
from sqlalchemy.dialects.postgresql import JSONB
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
    # معدل (۰ تا ۲۰، با اعشار)
    gpa: Mapped[float | None] = mapped_column(Numeric(4, 2), nullable=True)
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
    payload: Mapped[dict | None] = mapped_column(JSONB, nullable=True)


class Sale(Base):
    """فیشِ فروش — سرستونِ یک رسید؛ محصولاتِ خریداری‌شده در جدول sale_items هستند.

    «مبلغ جدا برای هر محصول» (درخواست کارفرما) → هر محصول یک ردیف در sale_items.
    `amount` اینجا = جمعِ مبالغِ آیتم‌ها (برای سازگاری و سرعتِ کوئری‌های جمع کل).
    `product`/`program_months` نیز برای سازگاری با گزارش‌ها نگه داشته می‌شوند
    (تک‌محصولی = همان محصول؛ چندمحصولی = «چند محصول»).
    """
    __tablename__ = "sales"
    tenant_id: Mapped[UUID | None] = mapped_column(nullable=True)
    student_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("students.id", ondelete="SET NULL"), nullable=True, index=True)
    agent_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    # نام/موبایل به‌صورت snapshot هم ذخیره می‌شوند (برای فیش مستقل از سرنخ)
    student_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    mobile: Mapped[str | None] = mapped_column(String(20), nullable=True, index=True)
    # خلاصه‌ی محصول (سازگاری/نمایش): تک‌محصولی=نام محصول، چندمحصولی=«چند محصول»
    product: Mapped[str] = mapped_column(String(100))
    program_months: Mapped[int | None] = mapped_column(Integer, nullable=True)
    amount: Mapped[float] = mapped_column(Numeric(14, 0), default=0)  # جمع آیتم‌ها
    # نوع پرداخت دیگر استفاده نمی‌شود (به‌جایش اسناد واریزِ زیر) — ستون برای سازگاری مانده
    payment_method: Mapped[str | None] = mapped_column(String(50), nullable=True)
    payment_ref: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # اسناد واریز (درخواست کارفرما)
    deposited_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True)  # ساعت+تاریخِ واریز
    payer_card: Mapped[str | None] = mapped_column(String(50), nullable=True)  # کارت واریزکننده
    dest_account: Mapped[str | None] = mapped_column(String(100), nullable=True)  # بانک مقصد (حساب ما)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    sold_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    # موعد تمدید (فقط برای برنامه): sold_at + program_months — برای یادآوری
    renewal_due_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True)


class SaleItem(Base):
    """آیتمِ یک فیش فروش — یک محصول با مبلغِ جداگانه‌ی خودش.

    «مبلغ جدا برای هر محصول»: جمعِ تفکیکیِ «برنامه» و «دوره» از همین جدول
    (GROUP BY روی product) محاسبه می‌شود تا دقیق بماند حتی برای فیشِ ترکیبی.
    """
    __tablename__ = "sale_items"
    sale_id: Mapped[UUID] = mapped_column(
        ForeignKey("sales.id", ondelete="CASCADE"), index=True)
    product: Mapped[str] = mapped_column(String(100))
    program_months: Mapped[int | None] = mapped_column(Integer, nullable=True)
    amount: Mapped[float] = mapped_column(Numeric(14, 0), default=0)


class InstallmentPlan(Base):
    """پلنِ اقساطِ برنامه — مثل شیتِ اکسلِ کارفرما (افزودنِ دستی).

    هر ردیف: دانش‌آموز، مشاور، مبلغِ کل، تعداد اقساط، مبلغِ هر قسط، ماهِ شروع.
    وضعیتِ پرداختِ هر قسط در `paid` (آرایه‌ی شماره‌اقساطِ پرداخت‌شده) نگه داشته
    می‌شود — با کلیک روی خانه‌ی هر ماه تیک/برداشته می‌شود.
    """
    __tablename__ = "installment_plans"
    tenant_id: Mapped[UUID | None] = mapped_column(nullable=True)
    student_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    mobile: Mapped[str | None] = mapped_column(String(20), nullable=True, index=True)
    advisor: Mapped[str | None] = mapped_column(String(100), nullable=True)  # مشاور
    amount: Mapped[float] = mapped_column(Numeric(14, 0), default=0)          # مبلغ کل (تومان)
    count: Mapped[int] = mapped_column(Integer, default=1)                    # تعداد اقساط
    installment_amount: Mapped[float] = mapped_column(Numeric(14, 0), default=0)  # قسط (تومان)
    start_month: Mapped[str | None] = mapped_column(String(20), nullable=True)    # ماهِ شروع (شمسی)
    paid: Mapped[list | None] = mapped_column(JSONB, nullable=True)           # شماره‌اقساطِ پرداخت‌شده
    note: Mapped[str | None] = mapped_column(Text, nullable=True)


class Message(Base):
    """لاگ پیام‌های ارسالی به مخاطب — پیامک سامانه‌ای / واتساپ / تلگرام.

    برای گزارش «چه چیزی برای این شخص ارسال شده». ارسالِ واقعیِ پیامک پشت
    SmsProvider است؛ واتساپ/تلگرام از سمت کلاینت (لینک) باز می‌شوند و اینجا
    فقط ثبت می‌شوند.
    """
    __tablename__ = "messages"
    student_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("students.id", ondelete="SET NULL"), nullable=True, index=True)
    sender_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    mobile: Mapped[str | None] = mapped_column(String(20), nullable=True)
    # کانال: sms / whatsapp / telegram
    channel: Mapped[str] = mapped_column(String(20))
    body: Mapped[str] = mapped_column(Text)
    # وضعیت: sent / queued / failed
    status: Mapped[str] = mapped_column(String(20), default="sent")
