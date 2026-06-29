"""اجرای پایپ‌لاین تحلیل برای یک تماس (داخل Celery)."""


async def run_pipeline_async(call_id: str) -> dict:
    """
    1) خواندن تماس و recording_url
    2) دانلود فایل از Provider و ذخیره در S3
    3) اجرای AnalyzeCallUseCase (LangGraph)
    4) ذخیره‌ی transcript, lead_score, suggested_stage و به‌روزرسانی دانشجو
    """
    from src.modules.ai_analysis.application.analyze_call import AnalyzeCallUseCase
    from src.modules.ai_analysis.infrastructure.providers.factory import (
        get_llm_provider,
        get_stt_provider,
    )
    from src.modules.ai_analysis.infrastructure.repository import AnalysisRepository
    from src.modules.telephony.infrastructure.factory import get_telephony_provider
    from src.shared.storage.s3 import S3Storage

    repo = AnalysisRepository()
    call = await repo.get_call(call_id)
    if call is None:
        return {"status": "call_not_found"}

    # دانلود و ذخیره‌ی فایل صوتی
    tel = get_telephony_provider()
    audio = await tel.fetch_recording(call["external_id"], call.get("recording_url"))
    storage = S3Storage()
    storage_key = await storage.put(f"recordings/{call_id}.mp3", audio)
    await repo.save_recording(call_id, storage_key, len(audio))

    # تاریخچه‌ی تماس‌ها/امتیازهای قبلی برای امتیازدهی بهتر
    history = await repo.get_history(call.get("student_id"))

    use_case = AnalyzeCallUseCase(get_llm_provider(), get_stt_provider())
    result = await use_case.execute(
        call_id=call_id, recording_key=storage_key, audio_bytes=audio,
        student_id=call.get("student_id"), history=history,
    )

    await repo.save_analysis(call_id, call.get("student_id"), result)

    # 🆕 پرکردنِ خودکارِ فیلدهای خالیِ دانشجو از اطلاعاتِ استخراج‌شده (فاز A).
    # کاملاً امن: فقط فیلدهای خالی، بدون حذف، با گیتِ اطمینان. خطا پایپ‌لاین را نمی‌شکند.
    autofill = {"filled": {}}
    try:
        autofill = await repo.autofill_student_from_extraction(
            call.get("student_id"), result.extracted)
    except Exception:  # noqa: BLE001 — پرکردن نباید کلِ تحلیل را خراب کند
        autofill = {"filled": {}, "error": True}

    return {"status": "analyzed", "lead_score": result.lead_score,
            "needs_review": result.needs_review, "autofilled": autofill.get("filled", {})}
