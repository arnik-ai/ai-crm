"""مدل State برای گراف تحلیل تماس."""
from typing import Literal, Optional, TypedDict

from src.modules.ai_analysis.domain.models import ExtractedInfo


class CallAnalysisState(TypedDict, total=False):
    # ورودی
    call_id: str
    recording_key: str
    student_id: Optional[str]
    history: list[dict]
    audio_bytes: Optional[bytes]

    # مراحل
    transcript: Optional[str]
    segments: Optional[list[dict]]
    extracted: Optional[ExtractedInfo]
    lead_score: Optional[int]
    registration_probability: Optional[float]
    suggested_stage: Optional[str]
    followup_date: Optional[str]
    next_best_action: Optional[str]
    manager_summary: Optional[str]

    # کنترل
    errors: list[str]
    needs_review: bool
    status: Literal["running", "completed", "failed"]
