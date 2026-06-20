"""Portها (اینترفیس‌ها) برای ماژول تلفنی — لایه‌ی Application فقط با این‌ها کار می‌کند."""
from abc import ABC, abstractmethod

from src.modules.telephony.domain.events import TelephonyEvent


class TelephonyProvider(ABC):
    """انتزاع ارائه‌دهنده‌ی تلفنی (Workano, Issabel, Asterisk, ...)."""

    name: str

    @abstractmethod
    def verify_signature(self, raw_body: bytes, headers: dict) -> bool:
        """اعتبارسنجی امضای Webhook (HMAC)."""

    @abstractmethod
    def parse_event(self, payload: dict) -> TelephonyEvent:
        """تبدیل Payload خام Provider به رخداد دامنه‌ای."""

    @abstractmethod
    async def fetch_recording(self, external_call_id: str,
                              recording_url: str | None = None) -> bytes:
        """دانلود فایل صوتی ضبط‌شده."""
