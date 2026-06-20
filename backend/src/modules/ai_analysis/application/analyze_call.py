"""Use Case: تحلیل کامل یک تماس از فایل صوتی تا نتیجه‌ی ساختاریافته."""
from src.modules.ai_analysis.application.ports import LLMProvider, SpeechToTextProvider
from src.modules.ai_analysis.domain.models import CallAnalysisResult, ExtractedInfo
from src.modules.ai_analysis.infrastructure.langgraph.graph import (
    build_call_analysis_graph,
)


class AnalyzeCallUseCase:
    def __init__(self, llm: LLMProvider, stt: SpeechToTextProvider):
        self._graph = build_call_analysis_graph(llm, stt)

    async def execute(
        self,
        call_id: str,
        recording_key: str,
        audio_bytes: bytes,
        student_id: str | None = None,
        history: list[dict] | None = None,
    ) -> CallAnalysisResult:
        initial = {
            "call_id": call_id,
            "recording_key": recording_key,
            "audio_bytes": audio_bytes,
            "student_id": student_id,
            "history": history or [],
            "errors": [],
            "needs_review": False,
            "status": "running",
        }
        final = await self._graph.ainvoke(initial)

        extracted = final.get("extracted") or ExtractedInfo()
        return CallAnalysisResult(
            call_id=call_id,
            transcript=final.get("transcript"),
            segments=final.get("segments") or [],
            extracted=extracted,
            lead_score=final.get("lead_score") or 0,
            registration_probability=final.get("registration_probability") or 0.0,
            suggested_stage=final.get("suggested_stage") or "Contacted",
            next_best_action=final.get("next_best_action") or "",
            manager_summary=final.get("manager_summary") or "",
            needs_review=final.get("needs_review", False),
        )
