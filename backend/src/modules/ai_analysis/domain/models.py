"""مدل‌های دامنه‌ی تحلیل AI — اطلاعات استخراج‌شده و نتیجه‌ی تحلیل."""
from typing import Literal, Optional

from pydantic import BaseModel, Field


class ExtractedInfo(BaseModel):
    """اطلاعات کسب‌وکاری استخراج‌شده از مکالمه."""

    full_name: Optional[str] = Field(None, description="نام کامل دانشجو/سرنخ")
    course_name: Optional[str] = Field(None, description="نام دوره‌ی موردعلاقه")
    educational_goal: Optional[str] = Field(None, description="هدف آموزشی")
    registration_intention: Optional[Literal["high", "medium", "low", "none"]] = None
    objections: list[str] = Field(default_factory=list, description="اعتراض‌ها/موانع")
    budget_concern: Optional[bool] = Field(None, description="دغدغه‌ی بودجه/شهریه")
    preferred_followup_date: Optional[str] = Field(None, description="تاریخ پیگیری ISO")
    urgency: Optional[Literal["high", "medium", "low"]] = None
    purchase_signals: list[str] = Field(default_factory=list)


class LeadScoreResult(BaseModel):
    score: int = Field(ge=0, le=100)
    registration_probability: float = Field(ge=0.0, le=1.0)
    rationale: Optional[str] = None


class StageSuggestion(BaseModel):
    suggested_stage: str
    confidence: float = Field(ge=0.0, le=1.0)


class FollowUpSuggestion(BaseModel):
    followup_date: Optional[str] = None
    action_type: str
    note: Optional[str] = None


class ManagerSummary(BaseModel):
    summary: str
    next_best_action: str


class CallAnalysisResult(BaseModel):
    """خروجی نهایی پایپ‌لاین تحلیل تماس."""

    call_id: str
    extracted: ExtractedInfo
    lead_score: int
    registration_probability: float
    suggested_stage: str
    next_best_action: str
    manager_summary: str
    needs_review: bool = False
