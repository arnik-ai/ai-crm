"""دستیار چت CRM — تبدیل پرسش زبان طبیعی به Intent امن و اجرای کوئری.

الگوی طراحی: به‌جای تولید مستقیم SQL (ناامن)، LLM یک «Intent» ساختاریافته از مجموعه‌ی
محدود تولید می‌کند؛ سپس کوئری پارامتری متناظر اجرا می‌شود (جلوگیری از SQL Injection).
"""
from typing import Literal, Optional

from pydantic import BaseModel

from src.modules.ai_analysis.infrastructure.providers.factory import get_llm_provider


class AssistantIntent(BaseModel):
    intent: Literal[
        "call_today",                 # امروز با چه کسانی تماس بگیرم؟
        "likely_to_register",         # احتمال ثبت‌نام بالا
        "interested_in_course",       # علاقه‌مند به دوره‌ی خاص
        "price_objections",           # اعتراض قیمتی
        "no_followup_n_days",         # بدون پیگیری در N روز
        "unknown",
    ]
    course_name: Optional[str] = None
    days: Optional[int] = None
    probability_threshold: Optional[float] = None


_SYSTEM = (
    "تو دستیار CRM یک مؤسسه‌ی آموزشی هستی. پرسش کاربر را به یکی از intentهای مجاز نگاشت کن. "
    "اگر در دسته‌ای نمی‌گنجد، intent=unknown."
)


class AssistantService:
    async def answer(self, message: str, tenant_id: str | None,
                     agent_id: str) -> dict:
        llm = get_llm_provider()
        intent: AssistantIntent = await llm.complete(  # type: ignore[assignment]
            _SYSTEM, message, schema=AssistantIntent
        )
        students = await self._run_intent(intent, tenant_id, agent_id)
        answer = self._format_answer(intent, students)
        return {"answer": answer, "intent": intent.intent, "students": students}

    async def _run_intent(self, intent: AssistantIntent, tenant_id, agent_id) -> list:
        """نگاشت intent به کوئری پارامتری امن (پیاده‌سازی در AssistantRepository)."""
        from src.modules.assistant.infrastructure.repository import AssistantRepository
        repo = AssistantRepository()
        match intent.intent:
            case "call_today":
                return await repo.followups_due_today(agent_id)
            case "likely_to_register":
                return await repo.high_probability(intent.probability_threshold or 0.7)
            case "interested_in_course":
                return await repo.interested_in(intent.course_name or "")
            case "price_objections":
                return await repo.with_price_objection()
            case "no_followup_n_days":
                return await repo.no_followup_since(intent.days or 7)
            case _:
                return []

    def _format_answer(self, intent: AssistantIntent, students: list) -> str:
        if not students:
            return "موردی مطابق درخواست شما یافت نشد."
        return f"{len(students)} مورد مطابق درخواست شما یافت شد."
