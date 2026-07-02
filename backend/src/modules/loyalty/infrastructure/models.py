"""مدل‌های ORM ماژولِ باشگاه مشتریان (Loyalty).

⚠️ استقلال/حذف‌پذیری: این مدل‌ها به مدل‌های هسته (Student/Sale/Call) **وابسته نیستند**
و FK سختی به آن‌ها ندارند؛ فقط `student_id`/`account_id` را به‌صورتِ ارجاعِ نرم (uuid)
نگه می‌دارند. پس drop شدنِ این جدول‌ها هیچ constraintـی روی جدول‌های اصلی نمی‌شکند.
جدول‌ها با migration `0010_loyalty` ساخته می‌شوند (نه در schema.sql هسته).
"""
from datetime import date, datetime
from uuid import UUID

from sqlalchemy import Boolean, Date, DateTime, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from src.shared.db.base import Base


class LoyaltyAccount(Base):
    """حساب امتیازِ هر دانش‌آموز (۱:۱ نرم با student_id)."""
    __tablename__ = "loyalty_accounts"
    student_id: Mapped[UUID | None] = mapped_column(nullable=True, unique=True, index=True)
    points_balance: Mapped[int] = mapped_column(Integer, default=0)      # موجودیِ قابلِ‌خرج
    points_lifetime: Mapped[int] = mapped_column(Integer, default=0)     # کلِ کسب‌شده (مبنای سطح)
    level: Mapped[str] = mapped_column(String(20), default="bronze")
    referral_code: Mapped[str | None] = mapped_column(String(20), nullable=True, unique=True)
    referred_by: Mapped[UUID | None] = mapped_column(nullable=True)      # account.id معرف
    birthday: Mapped[date | None] = mapped_column(Date, nullable=True)


class PointTransaction(Base):
    """دفترِ کل امتیاز (Ledger) — منبعِ حقیقتِ موجودی.

    `idempotency_key` یکتا (= dedup_key رویداد + کلید rule) تضمین می‌کند یک رویداد
    هرگز دوبار امتیاز ندهد (ضدِ دوباره‌شماری در projection/retry).
    """
    __tablename__ = "loyalty_point_transactions"
    account_id: Mapped[UUID | None] = mapped_column(nullable=True, index=True)
    delta: Mapped[int] = mapped_column(Integer)                          # + یا -
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)      # کلیدِ ruleِ اجراشده
    event_id: Mapped[UUID | None] = mapped_column(nullable=True)
    rule_id: Mapped[UUID | None] = mapped_column(nullable=True)
    idempotency_key: Mapped[str | None] = mapped_column(String(255), nullable=True, unique=True)
    meta: Mapped[dict | None] = mapped_column(JSONB, nullable=True)


class LoyaltyLevel(Base):
    """سطح‌بندی (پیکربندیِ داده‌ای، نه هاردکد)."""
    __tablename__ = "loyalty_levels"
    key: Mapped[str] = mapped_column(String(30), unique=True)
    title: Mapped[str | None] = mapped_column(String(50), nullable=True)
    min_points: Mapped[int] = mapped_column(Integer)
    order_index: Mapped[int] = mapped_column(Integer)
    benefits: Mapped[list | None] = mapped_column(JSONB, nullable=True)


class LoyaltyRule(Base):
    """قانونِ امتیازدهیِ JSON-محور و نسخه‌دار (اجرا توسطِ Rule Engineِ قطعی)."""
    __tablename__ = "loyalty_rules"
    key: Mapped[str] = mapped_column(String(60), unique=True)
    event_type: Mapped[str | None] = mapped_column(String(60), nullable=True, index=True)
    definition: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    priority: Mapped[int] = mapped_column(Integer, default=100)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    valid_from: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    valid_to: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class LoyaltyEvent(Base):
    """لاگِ رویدادها (auditٍ چه چیزی دیده/پردازش شد). `dedup_key` یکتا برای ثبتِ یک‌بار."""
    __tablename__ = "loyalty_events"
    type: Mapped[str] = mapped_column(String(60))
    entity: Mapped[str | None] = mapped_column(String(60), nullable=True)
    entity_id: Mapped[UUID | None] = mapped_column(nullable=True)
    student_id: Mapped[UUID | None] = mapped_column(nullable=True)
    payload: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    occurred_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    dedup_key: Mapped[str | None] = mapped_column(String(255), nullable=True, unique=True)


class LoyaltyCheckpoint(Base):
    """نشانگرِ آخرین زمانِ پردازش‌شده‌ی هر منبع (برای projectionِ بهینه)."""
    __tablename__ = "loyalty_checkpoints"
    source: Mapped[str] = mapped_column(String(60), unique=True)
    last_ts: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


# ---------- فاز ۲: پاداش، مصرف، معرفی ----------

class Reward(Base):
    """کاتالوگِ پاداش‌ها (داده‌ای؛ افزودن بدونِ deploy)."""
    __tablename__ = "loyalty_rewards"
    key: Mapped[str | None] = mapped_column(String(60), nullable=True, unique=True)
    title: Mapped[str | None] = mapped_column(String(120), nullable=True)
    cost_points: Mapped[int] = mapped_column(Integer)
    type: Mapped[str] = mapped_column(String(40))          # free_session|discount|free_course|private_class|coupon
    payload: Mapped[dict | None] = mapped_column(JSONB, nullable=True)   # {percent:10} یا {course_id:...}
    min_level: Mapped[str | None] = mapped_column(String(30), nullable=True)
    stock: Mapped[int | None] = mapped_column(Integer, nullable=True)    # null = نامحدود
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class Redemption(Base):
    """مصرفِ امتیاز (خریدِ پاداش) یا کوپنِ هدیه (مثلِ ۵٪ خوش‌آمدِ معرفی)."""
    __tablename__ = "loyalty_redemptions"
    account_id: Mapped[UUID | None] = mapped_column(nullable=True, index=True)
    reward_id: Mapped[UUID | None] = mapped_column(nullable=True)        # null = کوپنِ هدیه
    points_spent: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(20), default="approved")  # pending|approved|fulfilled|expired|canceled
    coupon_code: Mapped[str | None] = mapped_column(String(40), nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    meta: Mapped[dict | None] = mapped_column(JSONB, nullable=True)


class Referral(Base):
    """معرفیِ دوستان — معرف/معرفی‌شده + وضعیت + فلگ‌های ضدِ پاداشِ دوباره."""
    __tablename__ = "loyalty_referrals"
    referrer_account_id: Mapped[UUID | None] = mapped_column(nullable=True, index=True)
    referred_student_id: Mapped[UUID | None] = mapped_column(nullable=True, index=True)
    code_used: Mapped[str | None] = mapped_column(String(20), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="pending")   # pending|registered|purchased
    signup_rewarded: Mapped[bool] = mapped_column(Boolean, default=False)
    purchase_rewarded: Mapped[bool] = mapped_column(Boolean, default=False)
