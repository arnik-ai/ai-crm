"""نودهای گراف تحلیل تماس — هر نود یک ایجنت."""
import json

from src.modules.ai_analysis.application.ports import LLMProvider, SpeechToTextProvider
from src.modules.ai_analysis.domain.models import (
    ExtractedInfo,
    FollowUpSuggestion,
    LeadScoreResult,
    ManagerSummary,
    StageSuggestion,
)
from src.modules.ai_analysis.infrastructure.langgraph.state import CallAnalysisState

_MIN_TRANSCRIPT_LEN = 20


def make_transcript_node(stt: SpeechToTextProvider):
    async def node(state: CallAnalysisState) -> CallAnalysisState:
        try:
            audio = state.get("audio_bytes")
            if not audio:
                state.setdefault("errors", []).append("فایل صوتی موجود نیست")
                state["needs_review"] = True
                return state
            result = await stt.transcribe(audio, language="fa")
            state["transcript"] = result.content
            state["segments"] = result.segments
        except Exception as exc:  # noqa: BLE001
            state.setdefault("errors", []).append(f"transcript: {exc}")
            state["needs_review"] = True
        return state

    return node


def make_extraction_node(llm: LLMProvider):
    system = (
        "تو یک تحلیلگر فروش آموزشی هستی. از متن مکالمه‌ی تلفنی، اطلاعات کسب‌وکاری را دقیق "
        "استخراج کن. اگر اطلاعاتی موجود نیست null بگذار و هرگز حدس نزن. خروجی فقط طبق schema."
    )

    async def node(state: CallAnalysisState) -> CallAnalysisState:
        try:
            text = state.get("transcript") or ""
            result = await llm.complete(system, f"متن مکالمه:\n{text}",
                                        schema=ExtractedInfo)
            state["extracted"] = result  # type: ignore[assignment]
        except Exception as exc:  # noqa: BLE001
            state.setdefault("errors", []).append(f"extract: {exc}")
            state["extracted"] = ExtractedInfo()
            state["needs_review"] = True
        return state

    return node


def make_scoring_node(llm: LLMProvider):
    system = (
        "بر اساس اطلاعات استخراج‌شده و تاریخچه، امتیاز سرنخ (۰ تا ۱۰۰) و احتمال ثبت‌نام "
        "(۰ تا ۱) را تعیین کن. سیگنال‌های خرید و فوریت را وزن بده."
    )

    async def node(state: CallAnalysisState) -> CallAnalysisState:
        try:
            extracted = state.get("extracted")
            history = state.get("history", [])
            user = (f"اطلاعات: {extracted.model_dump_json() if extracted else '{}'}\n"
                    f"تاریخچه: {json.dumps(history, ensure_ascii=False)}")
            result: LeadScoreResult = await llm.complete(system, user,
                                                         schema=LeadScoreResult)  # type: ignore
            state["lead_score"] = result.score
            state["registration_probability"] = result.registration_probability
        except Exception as exc:  # noqa: BLE001
            state.setdefault("errors", []).append(f"score: {exc}")
            state["lead_score"] = 0
            state["registration_probability"] = 0.0
        return state

    return node


def make_stage_node(llm: LLMProvider):
    system = (
        "مرحله‌ی فروش مناسب را از این مجموعه انتخاب کن: New Lead, Contacted, Interested, "
        "Consultation, Negotiation, Registration Completed, Lost."
    )

    async def node(state: CallAnalysisState) -> CallAnalysisState:
        try:
            extracted = state.get("extracted")
            user = (f"اطلاعات: {extracted.model_dump_json() if extracted else '{}'}\n"
                    f"امتیاز: {state.get('lead_score')}")
            result: StageSuggestion = await llm.complete(system, user,
                                                        schema=StageSuggestion)  # type: ignore
            state["suggested_stage"] = result.suggested_stage
        except Exception as exc:  # noqa: BLE001
            state.setdefault("errors", []).append(f"stage: {exc}")
            state["suggested_stage"] = "Contacted"
        return state

    return node


def make_followup_node(llm: LLMProvider):
    system = "تاریخ و نوع پیگیری بعدی را پیشنهاد بده (تاریخ به فرمت ISO)."

    async def node(state: CallAnalysisState) -> CallAnalysisState:
        try:
            extracted = state.get("extracted")
            user = f"اطلاعات: {extracted.model_dump_json() if extracted else '{}'}"
            result: FollowUpSuggestion = await llm.complete(system, user,
                                                           schema=FollowUpSuggestion)  # type: ignore
            state["followup_date"] = result.followup_date
        except Exception as exc:  # noqa: BLE001
            state.setdefault("errors", []).append(f"followup: {exc}")
        return state

    return node


def make_manager_node(llm: LLMProvider):
    system = (
        "خلاصه‌ی مدیریتی کوتاه از مکالمه و «بهترین اقدام بعدی» (Next Best Action) را "
        "برای مدیر فروش تولید کن."
    )

    async def node(state: CallAnalysisState) -> CallAnalysisState:
        try:
            payload = {
                "extracted": state.get("extracted").model_dump()  # type: ignore[union-attr]
                if state.get("extracted") else {},
                "lead_score": state.get("lead_score"),
                "stage": state.get("suggested_stage"),
            }
            user = json.dumps(payload, ensure_ascii=False)
            result: ManagerSummary = await llm.complete(system, user,
                                                       schema=ManagerSummary)  # type: ignore
            state["manager_summary"] = result.summary
            state["next_best_action"] = result.next_best_action
        except Exception as exc:  # noqa: BLE001
            state.setdefault("errors", []).append(f"manager: {exc}")
        state["status"] = "completed"
        return state

    return node


def route_after_transcript(state: CallAnalysisState) -> str:
    text = state.get("transcript") or ""
    if len(text.strip()) < _MIN_TRANSCRIPT_LEN:
        return "review"
    return "continue"
