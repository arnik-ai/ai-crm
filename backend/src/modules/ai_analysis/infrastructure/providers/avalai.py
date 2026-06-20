"""پیاده‌سازی AvalAI برای LLM (GPT-5.5) و STT (Whisper).

AvalAI سازگار با API استاندارد OpenAI است؛ از AsyncOpenAI با base_url اختصاصی استفاده می‌شود.
"""
import asyncio
import io
from typing import Optional

from openai import AsyncOpenAI
from pydantic import BaseModel

from src.modules.ai_analysis.application.ports import (
    LLMProvider,
    SpeechToTextProvider,
    Transcript,
)


class AvalAILLMProvider(LLMProvider):
    def __init__(self, api_key: str, base_url: str, model: str = "gpt-5.5",
                 timeout: int = 60, max_retries: int = 3):
        self._client = AsyncOpenAI(api_key=api_key, base_url=base_url, timeout=timeout)
        self._model = model
        self._max_retries = max_retries

    async def complete(self, system, user, schema: Optional[type[BaseModel]] = None,
                       temperature: float = 0.2):
        last_exc: Exception | None = None
        for attempt in range(self._max_retries):
            try:
                if schema is not None:
                    resp = await self._client.beta.chat.completions.parse(
                        model=self._model, temperature=temperature,
                        messages=[{"role": "system", "content": system},
                                  {"role": "user", "content": user}],
                        response_format=schema,
                    )
                    return resp.choices[0].message.parsed
                resp = await self._client.chat.completions.create(
                    model=self._model, temperature=temperature,
                    messages=[{"role": "system", "content": system},
                              {"role": "user", "content": user}],
                )
                return resp.choices[0].message.content or ""
            except Exception as exc:  # noqa: BLE001 — retry با backoff نمایی
                last_exc = exc
                await asyncio.sleep((attempt + 1) ** 2)
        raise RuntimeError(f"خطای LLM پس از {self._max_retries} تلاش") from last_exc


class AvalAIWhisperProvider(SpeechToTextProvider):
    def __init__(self, api_key: str, base_url: str, model: str = "whisper-1",
                 timeout: int = 120):
        self._client = AsyncOpenAI(api_key=api_key, base_url=base_url, timeout=timeout)
        self._model = model

    async def transcribe(self, audio: bytes, language: str = "fa") -> Transcript:
        f = io.BytesIO(audio)
        f.name = "audio.mp3"
        resp = await self._client.audio.transcriptions.create(
            model=self._model, file=f, language=language,
            response_format="verbose_json",
        )
        segments = []
        for seg in (getattr(resp, "segments", None) or []):
            segments.append(seg.model_dump() if hasattr(seg, "model_dump") else dict(seg))
        return Transcript(content=resp.text, segments=segments, language=language)
