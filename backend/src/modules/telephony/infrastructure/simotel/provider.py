"""پیاده‌سازی SimotelProvider — یک نمونه از TelephonyProvider برای مرکز تماس سیموتل.

مرجع رویدادها: https://wiki.simotel.com/developers/SimotelWebhooks

رویدادهای کلیدی سیموتل:
  - IncomingCall : تماس ورودی   → فیلدها: event_name, number, unique_id, entry_point
  - OutgoingCall : تماس خروجی   → فیلدها: event_name, number, unique_id, exit_point
  - CDRQueue     : پایان تماس صف → فیلدها: unique_id, src, dst, queue, billsec, wait,
                    duration, disposition, record (فایل mp3), starttime, endtime,
                    answeredtime, ringtime, detail[]

نگاشت به دامنه:
  IncomingCall  → incoming
  OutgoingCall  → outgoing
  CDRQueue با disposition != ANSWERED → missed
  CDRQueue با record (فایل ضبط)       → recording_ready  (پایپ‌لاین AI فعال می‌شود)
  CDRQueue بدون record                → finished
"""
import hashlib
import hmac
from datetime import datetime, timezone

import httpx

from src.modules.telephony.application.ports import TelephonyProvider
from src.modules.telephony.domain.events import TelephonyEvent


class SimotelProvider(TelephonyProvider):
    name = "simotel"

    def __init__(self, webhook_token: str, api_base: str, api_token: str,
                 webhook_secret: str = ""):
        self._webhook_token = webhook_token
        self._webhook_secret = webhook_secret.encode() if webhook_secret else b""
        self._api_base = api_base.rstrip("/")
        self._api_token = api_token

    # ------------------------------------------------------------------
    # احراز هویت وب‌هوک
    # سیموتل به‌طور پیش‌فرض امضای HMAC استاندارد ندارد؛ بنابراین یک «توکن مشترک»
    # در بدنه یا هدر بررسی می‌شود. اگر webhook_secret تنظیم شده باشد، HMAC هم
    # (در صورت ارسال توسط reverse-proxy) پشتیبانی می‌شود.
    # ------------------------------------------------------------------
    def verify_signature(self, raw_body: bytes, headers: dict) -> bool:
        # حالت ۱: امضای HMAC (اگر جلوی سیموتل یک proxy امضاگذار باشد)
        if self._webhook_secret:
            sig = headers.get("x-simotel-signature", "")
            if sig.startswith("sha256="):
                sig = sig[len("sha256="):]
            if sig:
                expected = hmac.new(
                    self._webhook_secret, raw_body, hashlib.sha256
                ).hexdigest()
                return hmac.compare_digest(expected, sig)

        # حالت ۲: توکن مشترک در هدر
        header_token = headers.get("x-simotel-token", "")
        if self._webhook_token and header_token:
            return hmac.compare_digest(self._webhook_token, header_token)

        # حالت ۳: توکن مشترک در بدنه‌ی JSON (رایج‌ترین حالت سیموتل)
        if self._webhook_token:
            import json
            try:
                body_token = json.loads(raw_body or b"{}").get("token", "")
            except (ValueError, TypeError):
                body_token = ""
            return bool(body_token) and hmac.compare_digest(
                self._webhook_token, str(body_token)
            )

        # اگر هیچ توکنی تنظیم نشده باشد (محیط توسعه)
        return True

    # ------------------------------------------------------------------
    def parse_event(self, payload: dict) -> TelephonyEvent:
        raw_event = payload.get("event_name", "")

        if raw_event == "IncomingCall":
            return self._parse_simple(payload, "incoming", "inbound")
        if raw_event == "OutgoingCall":
            return self._parse_simple(payload, "outgoing", "outbound")
        if raw_event == "CDRQueue":
            return self._parse_cdr(payload)

        # رویداد ناشناخته → به‌صورت finished ثبت می‌شود تا داده از دست نرود
        return TelephonyEvent(
            provider=self.name,
            event_type="finished",
            external_call_id=str(payload.get("unique_id", "")),
            direction="inbound",
            caller_number=str(payload.get("src", payload.get("number", ""))),
            callee_number=str(payload.get("dst", "")),
            raw=payload,
        )

    def _parse_simple(self, payload: dict, event_type: str,
                      direction: str) -> TelephonyEvent:
        number = str(payload.get("number", ""))
        # در ورودی، شماره تماس‌گیرنده number است؛ در خروجی، شماره مقصد number است.
        if direction == "inbound":
            caller, callee = number, str(payload.get("entry_point", ""))
        else:
            caller, callee = str(payload.get("exit_point", "")), number
        return TelephonyEvent(
            provider=self.name,
            event_type=event_type,  # type: ignore[arg-type]
            external_call_id=str(payload.get("unique_id", "")),
            direction=direction,  # type: ignore[arg-type]
            caller_number=caller,
            callee_number=callee,
            agent_extension=payload.get("entry_point") or payload.get("exit_point"),
            raw=payload,
        )

    def _parse_cdr(self, payload: dict) -> TelephonyEvent:
        disposition = str(payload.get("disposition", "")).upper()
        record = payload.get("record") or ""
        answered = disposition == "ANSWERED"

        if not answered:
            event_type = "missed"
        elif record:
            event_type = "recording_ready"  # فایل ضبط آماده است → تحلیل AI
        else:
            event_type = "finished"

        # جهت تماس از روی src/dst قابل تشخیص نیست؛ پیش‌فرض inbound، مگر صف خروجی.
        direction = "outbound" if payload.get("direction") == "outbound" else "inbound"

        return TelephonyEvent(
            provider=self.name,
            event_type=event_type,  # type: ignore[arg-type]
            external_call_id=str(payload.get("unique_id", "")),
            direction=direction,  # type: ignore[arg-type]
            caller_number=str(payload.get("src", "")),
            callee_number=str(payload.get("dst", "")),
            agent_extension=str(payload.get("dst", "")),
            started_at=_parse_epoch(payload.get("starttime")),
            ended_at=_parse_epoch(payload.get("endtime")),
            duration_sec=_to_int(payload.get("billsec")),
            recording_url=self._recording_url(record) if record else None,
            raw=payload,
        )

    def _recording_url(self, record: str) -> str:
        """سیموتل نام فایل را می‌دهد؛ آدرس کامل دانلود را می‌سازیم."""
        if record.startswith("http"):
            return record
        return f"{self._api_base}/records/{record}"

    # ------------------------------------------------------------------
    async def fetch_recording(self, external_call_id: str,
                              recording_url: str | None = None) -> bytes:
        url = recording_url or f"{self._api_base}/records/{external_call_id}.mp3"
        headers = {"Authorization": f"Bearer {self._api_token}"} if self._api_token else {}
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()
            return resp.content


def _to_int(value) -> int | None:
    try:
        return int(value) if value is not None else None
    except (ValueError, TypeError):
        return None


def _parse_epoch(value) -> datetime | None:
    """سیموتل زمان را به‌صورت epoch یا رشته‌ی تاریخ می‌فرستد."""
    if not value:
        return None
    # حالت عددی (epoch)
    try:
        return datetime.fromtimestamp(float(value), tz=timezone.utc)
    except (ValueError, TypeError, OSError):
        pass
    # حالت رشته‌ی ISO/تاریخ
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
