"""پردازش رخداد تلفنی (داخل Celery) — upsert تماس و صف‌بندی تحلیل AI."""


async def process_event_async(webhook_log_id: str) -> dict:
    """
    1) خواندن webhook_log
    2) تطبیق/ایجاد دانشجو بر اساس شماره موبایل
    3) upsert رکورد call
    4) ثبت activity در تایم‌لاین
    5) اگر event = recording_ready → enqueue analyze_call

    نکته: این تابع اسکلت است؛ منطق دسترسی به DB با Repositoryها انجام می‌شود.
    """
    from src.modules.telephony.infrastructure.repository import (
        CallRepository,
        WebhookLogRepository,
    )

    log_repo = WebhookLogRepository()
    call_repo = CallRepository()

    event = await log_repo.get_event(webhook_log_id)
    if event is None:
        return {"status": "log_not_found"}

    student_id = await call_repo.match_or_create_student(event.caller_number)
    call_id = await call_repo.upsert_call(event, student_id)
    await call_repo.add_activity(student_id, event)

    if event.event_type == "recording_ready":
        from app.worker import analyze_call_task
        analyze_call_task.delay(str(call_id))

    await log_repo.mark_done(webhook_log_id)
    return {"status": "processed", "call_id": str(call_id)}
