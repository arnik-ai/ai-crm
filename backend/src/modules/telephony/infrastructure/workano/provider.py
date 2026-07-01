"""پیاده‌سازی WorkanoProvider — یک نمونه از TelephonyProvider."""
import hashlib
import hmac
from datetime import datetime

import httpx

from src.modules.telephony.application.ports import TelephonyProvider
from src.modules.telephony.domain.events import TelephonyEvent

# نگاشت رویداد Workano به نوع رخداد دامنه
_EVENT_MAP = {
    "incoming": "incoming",
    "outgoing": "outgoing",
    "missed": "missed",
    "call_finished": "finished",
    "recording_ready": "recording_ready",
}


class WorkanoProvider(TelephonyProvider):
    name = "workano"

    def __init__(self, webhook_secret: str, api_base: str, api_key: str):
        self._secret = webhook_secret.encode()
        self._api_base = api_base.rstrip("/")
        self._api_key = api_key

    def verify_signature(self, raw_body: bytes, headers: dict) -> bool:
        # اگر کلیدِ امنیتی تنظیم نشده باشد، قفل باز است و همهٔ درخواست‌ها پذیرفته
        # می‌شوند. برای فعال‌کردنِ امنیت کافیست WORKANO_WEBHOOK_SECRET را در .env بگذاری.
        if not self._secret:
            return True
        sig = headers.get("x-workano-signature", "")
        if sig.startswith("sha256="):
            sig = sig[len("sha256="):]
        expected = hmac.new(self._secret, raw_body, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, sig)

    def parse_event(self, payload: dict) -> TelephonyEvent:
        raw_event = payload.get("event", "")
        return TelephonyEvent(
            provider=self.name,
            event_type=_EVENT_MAP.get(raw_event, "finished"),  # type: ignore[arg-type]
            external_call_id=str(payload["call_id"]),
            direction=payload.get("direction", "inbound"),
            caller_number=payload.get("from", ""),
            callee_number=payload.get("to", ""),
            agent_extension=payload.get("agent"),
            started_at=_parse_dt(payload.get("started_at")),
            ended_at=_parse_dt(payload.get("ended_at")),
            duration_sec=payload.get("duration"),
            recording_url=payload.get("recording_url"),
            raw=payload,
        )

    async def fetch_recording(self, external_call_id: str,
                              recording_url: str | None = None) -> bytes:
        url = recording_url or f"{self._api_base}/recordings/{external_call_id}"
        headers = {"Authorization": f"Bearer {self._api_key}"}
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()
            return resp.content


def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))
