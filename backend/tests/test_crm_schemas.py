"""تست‌های اعتبارسنجی schema — نرمال‌سازی موبایل و دسته‌بندی LangGraph."""
import pytest
from pydantic import ValidationError

from src.modules.ai_analysis.infrastructure.langgraph.nodes import (
    route_after_transcript,
)
from src.modules.crm.api.schemas import StudentCreate


@pytest.mark.parametrize("raw,normalized", [
    ("09121234567", "+989121234567"),
    ("+989121234567", "+989121234567"),
    ("989121234567", "+989121234567"),
])
def test_mobile_normalization(raw, normalized):
    student = StudentCreate(mobile=raw)
    assert student.mobile == normalized


def test_invalid_mobile_rejected():
    with pytest.raises(ValidationError):
        StudentCreate(mobile="12")


def test_route_after_transcript_short_goes_review():
    assert route_after_transcript({"transcript": "سلام"}) == "review"


def test_route_after_transcript_long_continues():
    long_text = "متن کافی برای ادامه‌ی پردازش تحلیل تماس و استخراج اطلاعات."
    assert route_after_transcript({"transcript": long_text}) == "continue"


def test_route_after_transcript_empty_goes_review():
    assert route_after_transcript({}) == "review"
