"""پیکربندی Celery و taskهای پردازش async تماس."""
import asyncio

from celery import Celery

from src.shared.config.settings import get_settings

settings = get_settings()

celery_app = Celery(
    "ai_crm",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
)
celery_app.conf.update(
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_routes={
        "tasks.process_telephony_event": {"queue": "telephony"},
        "tasks.analyze_call": {"queue": "llm"},
    },
    task_default_retry_delay=10,
    task_max_retries=3,
)


def _run(coro):
    """اجرای coroutine داخل task سنکرون Celery."""
    return asyncio.run(coro)


@celery_app.task(name="tasks.process_telephony_event", bind=True)
def process_telephony_event(self, webhook_log_id: str) -> dict:
    """گام اول: پردازش رخداد و در صورت recording_ready، صف‌بندی تحلیل."""
    from src.modules.telephony.application.process_event import process_event_async

    try:
        return _run(process_event_async(webhook_log_id))
    except Exception as exc:  # noqa: BLE001
        raise self.retry(exc=exc) from exc


@celery_app.task(name="tasks.analyze_call", bind=True)
def analyze_call_task(self, call_id: str) -> dict:
    """گام دوم: دانلود recording → LangGraph → ذخیره‌ی نتیجه."""
    from src.modules.ai_analysis.application.run_pipeline import run_pipeline_async

    try:
        return _run(run_pipeline_async(call_id))
    except Exception as exc:  # noqa: BLE001
        raise self.retry(exc=exc) from exc
