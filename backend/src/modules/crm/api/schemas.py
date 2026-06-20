"""Schemaهای CRM — اعتبارسنجی ورودی/خروجی."""
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class StudentCreate(BaseModel):
    full_name: str | None = None
    mobile: str = Field(pattern=r"^\+?\d{10,15}$")
    course_interest_id: UUID | None = None
    lead_source: str | None = None
    assigned_agent_id: UUID | None = None

    @field_validator("mobile")
    @classmethod
    def normalize_mobile(cls, v: str) -> str:
        v = v.strip().replace(" ", "")
        if v.startswith("0"):
            v = "+98" + v[1:]
        elif not v.startswith("+"):
            v = "+" + v
        return v


class StudentUpdate(BaseModel):
    full_name: str | None = None
    course_interest_id: UUID | None = None
    assigned_agent_id: UUID | None = None
    status: str | None = None


class StudentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    full_name: str | None
    mobile: str
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
