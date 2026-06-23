"""Schemaهای CRM — اعتبارسنجی ورودی/خروجی."""
from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

# مقادیر مجاز رشته/پایه/منبع تماس
StudyField = Literal["تجربی", "ریاضی", "انسانی", "سایر"]
Grade = Literal["دهم", "یازدهم", "دوازدهم", "فارغ‌التحصیل", "سایر"]
LeadSource = Literal["سایت", "اینستاگرام", "تلگرام", "روبیکا", "بله", "پیامک", "سایر"]


def _normalize_mobile(v: str) -> str:
    v = v.strip().replace(" ", "")
    if v.startswith("0"):
        v = "+98" + v[1:]
    elif not v.startswith("+"):
        v = "+" + v
    return v


class StudentCreate(BaseModel):
    full_name: str | None = None
    mobile: str = Field(pattern=r"^\+?\d{10,15}$")
    city: str | None = None
    field: StudyField | None = None
    grade: Grade | None = None
    goal: str | None = None
    course_interest_id: UUID | None = None
    lead_source: LeadSource | None = None
    assigned_agent_id: UUID | None = None

    @field_validator("mobile")
    @classmethod
    def normalize_mobile(cls, v: str) -> str:
        return _normalize_mobile(v)


class StudentUpdate(BaseModel):
    full_name: str | None = None
    city: str | None = None
    field: StudyField | None = None
    grade: Grade | None = None
    goal: str | None = None
    course_interest_id: UUID | None = None
    lead_source: LeadSource | None = None
    assigned_agent_id: UUID | None = None
    status: str | None = None


class StudentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    full_name: str | None
    mobile: str
    city: str | None = None
    field: str | None = None
    grade: str | None = None
    goal: str | None = None
    lead_source: str | None = None
    status: str
    sales_stage_id: UUID | None
    created_at: datetime


class StageChange(BaseModel):
    sales_stage_id: UUID


class NoteCreate(BaseModel):
    body: str = Field(min_length=1)


class FollowupCreate(BaseModel):
    student_id: UUID
    due_at: datetime
    note: str | None = None


class Paginated(BaseModel):
    items: list
    total: int
    page: int
    size: int


class CourseCreate(BaseModel):
    title: str = Field(min_length=1)
    slug: str = Field(pattern=r"^[a-z0-9\-]+$")
    price: float | None = None


class CourseUpdate(BaseModel):
    title: str | None = None
    price: float | None = None
    is_active: bool | None = None


class TagCreate(BaseModel):
    name: str = Field(min_length=1)
    color: str = "#3b82f6"


class TagAttach(BaseModel):
    tag_id: UUID


class StageCreate(BaseModel):
    name: str = Field(min_length=1)
    order_index: int
    is_terminal: bool = False
    color: str = "#888888"


# ---------- فروش (فیش) ----------
# لیست ثابت محصولات (مطابق فهرست کارفرما)
PRODUCTS = [
    "بمب دهم", "بمب یازدهم", "بمب دوازدهم", "جهش", "شبیه ساز", "روش مطالعه",
    "مصاحبه فرهنگیان", "منابع فرهنگیان", "آموزش انتخاب رشته", "انتخاب رشته",
    "پامپ", "تک جلسه", "برنامه",
]
PAYMENT_METHODS = ["کارت به کارت", "اقساط", "درگاه آنلاین", "نقدی"]
PROGRAM_PRODUCT = "برنامه"


class SaleCreate(BaseModel):
    student_name: str = Field(min_length=2)
    mobile: str = Field(pattern=r"^\+?\d{10,15}$")
    product: str
    program_months: int | None = Field(default=None, ge=1, le=12)
    amount: float = Field(ge=0)
    payment_method: str | None = None
    payment_ref: str | None = None
    note: str | None = None
    student_id: UUID | None = None

    @field_validator("mobile")
    @classmethod
    def normalize_mobile(cls, v: str) -> str:
        return _normalize_mobile(v)

    @field_validator("product")
    @classmethod
    def check_product(cls, v: str) -> str:
        if v not in PRODUCTS:
            raise ValueError("محصول نامعتبر است")
        return v

    @field_validator("program_months")
    @classmethod
    def check_months(cls, v, info):
        # برای «برنامه» مدت لازم است؛ برای بقیه باید خالی باشد
        product = info.data.get("product")
        if product == PROGRAM_PRODUCT and not v:
            raise ValueError("برای برنامه، مدت (ماه) لازم است")
        if product != PROGRAM_PRODUCT:
            return None
        return v


class SaleOut(BaseModel):
    id: str
    student_name: str | None = None
    mobile: str | None = None
    product: str
    program_months: int | None = None
    amount: float
    payment: str | None = None
    payment_ref: str | None = None
    date: str
    renewal_due: str | None = None
