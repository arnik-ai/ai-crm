"""سرویس پردازش Webhook — Idempotency، ثبت لاگ، صف‌بندی پردازش."""
from src.modules.telephony.application.ports import TelephonyProvider
from src.modules.telephony.domain.events import TelephonyEvent


async def handle_webhook(provider: TelephonyProvider, payload: dict) -> dict:
    """
    گام‌ها:
    1) parse رخداد به مدل دامنه
    2) ثبت webhook_log با کلید Idempotency (provider, event_type, external_id)
    3) اگر تکراری بود → duplicate
    4) در غیر این صورت → enqueue پردازش async و پاسخ accepted
    """
    event: TelephonyEvent = provider.parse_event(payload)

    # ثبت در webhook_logs و بررسی تکراری بودن (پیاده‌سازی واقعی با Repository)
    log_id, is_duplicate = await _persist_webhook_log(event)
    if is_duplicate:
        return {"status": "duplicate"}

    # صف‌بندی پردازش — Webhook باید سریع پاسخ دهد
    from app.worker import process_telephony_event
    process_telephony_event.delay(str(log_id))

    return {"status": "accepted"}


async def _persist_webhook_log(event: TelephonyEvent) -> tuple[str, bool]:
    """
    ثبت لاگ Webhook با UNIQUE(provider, event_type, external_id).
    در صورت تعارض (تکراری) → (existing_id, True).
    پیاده‌سازی واقعی در WebhookLogRepository.
    """
    from src.modules.telephony.infrastructure.repository import WebhookLogRepository

    repo = WebhookLogRepository()
    return await repo.upsert(event)
