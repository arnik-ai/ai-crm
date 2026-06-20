"""Factory برای Providerهای AI."""
from src.modules.ai_analysis.application.ports import LLMProvider, SpeechToTextProvider
from src.modules.ai_analysis.infrastructure.providers.avalai import (
    AvalAILLMProvider,
    AvalAIWhisperProvider,
)
from src.shared.config.settings import get_settings


def get_llm_provider() -> LLMProvider:
    s = get_settings()
    if s.ai_provider == "avalai":
        return AvalAILLMProvider(
            api_key=s.avalai_api_key, base_url=s.avalai_base_url,
            model=s.avalai_llm_model, timeout=s.ai_llm_timeout,
        )
    raise ValueError(f"Provider هوش‌مصنوعی پشتیبانی‌نشده: {s.ai_provider}")


def get_stt_provider() -> SpeechToTextProvider:
    s = get_settings()
    if s.ai_provider == "avalai":
        return AvalAIWhisperProvider(
            api_key=s.avalai_api_key, base_url=s.avalai_base_url,
            model=s.avalai_stt_model, timeout=s.ai_stt_timeout,
        )
    raise ValueError(f"Provider هوش‌مصنوعی پشتیبانی‌نشده: {s.ai_provider}")
