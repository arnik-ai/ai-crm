"""Portهای AI — LLMProvider و SpeechToTextProvider."""
from abc import ABC, abstractmethod
from typing import Optional

from pydantic import BaseModel


class Transcript(BaseModel):
    content: str
    segments: list[dict] = []
    language: str = "fa"


class LLMProvider(ABC):
    @abstractmethod
    async def complete(
        self,
        system: str,
        user: str,
        schema: Optional[type[BaseModel]] = None,
        temperature: float = 0.2,
    ) -> BaseModel | str:
        """تکمیل متن؛ در صورت دادن schema، خروجی ساختاریافته (JSON معتبر) برمی‌گرداند."""


class SpeechToTextProvider(ABC):
    @abstractmethod
    async def transcribe(self, audio: bytes, language: str = "fa") -> Transcript:
        """تبدیل گفتار به متن."""
