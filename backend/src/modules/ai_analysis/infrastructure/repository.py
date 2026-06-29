"""Repository تحلیل AI — خواندن تماس، ذخیره‌ی recording/transcript/lead_score."""
from uuid import UUID

from sqlalchemy import select

from src.modules.ai_analysis.domain.models import CallAnalysisResult, ExtractedInfo
from src.modules.ai_analysis.infrastructure.models import LeadScore
from src.modules.crm.infrastructure.models import Activity, Student
from src.modules.telephony.infrastructure.models import Call, Recording, Transcript
from src.shared.db.base import SessionLocal

# مقادیرِ مجاز برای پرکردنِ خودکار (هم‌خوان با enumهای CRM) — هر چیز خارج از این رد می‌شود.
_ALLOWED_FIELDS = {"تجربی", "ریاضی", "انسانی", "سایر"}
_ALLOWED_GRADES = {"دهم", "یازدهم", "دوازدهم", "فارغ‌التحصیل", "سایر"}
# اگر اطمینانِ مدل کمتر از این بود، هیچ فیلدی پر نمی‌شود (داده‌ی مشکوک ننشیند).
_MIN_AUTOFILL_CONFIDENCE = 0.6


class AnalysisRepository:
    async def get_call(self, call_id: str) -> dict | None:
        async with SessionLocal() as s:
            call = await s.get(Call, UUID(call_id))
            if call is None:
                return None
            return {"id": str(call.id), "external_id": call.external_id,
                    "recording_url": call.recording_url,
                    "student_id": str(call.student_id) if call.student_id else None}

    async def save_recording(self, call_id: str, storage_key: str, size: int) -> str:
        async with SessionLocal() as s:
            rec = await s.scalar(select(Recording).where(Recording.call_id == UUID(call_id)))
            if rec is None:
                rec = Recording(call_id=UUID(call_id))
                s.add(rec)
            rec.storage_key = storage_key
            rec.size_bytes = size
            rec.download_status = "downloaded"
            await s.flush()
            rec_id = str(rec.id)
            await s.commit()
            return rec_id

    async def get_history(self, student_id: str | None) -> list[dict]:
        if not student_id:
            return []
        async with SessionLocal() as s:
            rows = (await s.execute(
                select(LeadScore).where(LeadScore.student_id == UUID(student_id))
                .order_by(LeadScore.created_at.desc()).limit(5)
            )).scalars().all()
            return [{"score": r.score,
                     "probability": float(r.registration_probability or 0)} for r in rows]

    async def save_analysis(self, call_id: str, student_id: str | None,
                            result: CallAnalysisResult) -> None:
        async with SessionLocal() as s:
            # ذخیره‌ی transcript روی recording مرتبط
            rec = await s.scalar(select(Recording).where(Recording.call_id == UUID(call_id)))
            if rec and result.transcript:
                tr = await s.scalar(
                    select(Transcript).where(Transcript.recording_id == rec.id))
                if tr is None:
                    tr = Transcript(recording_id=rec.id)
                    s.add(tr)
                tr.content = result.transcript
                tr.segments = result.segments or None
                tr.language = result.language
                tr.engine = "avalai-whisper"
            if student_id:
                s.add(LeadScore(
                    student_id=UUID(student_id),
                    call_id=UUID(call_id),
                    score=result.lead_score,
                    registration_probability=result.registration_probability,
                    signals=result.extracted.model_dump(),
                    next_best_action=result.next_best_action,
                ))
            await s.commit()

    async def autofill_student_from_extraction(
        self, student_id: str | None, extracted: ExtractedInfo | None
    ) -> dict:
        """فیلدهای **خالیِ** دانشجو را از اطلاعاتِ استخراج‌شده‌ی AI پر می‌کند.

        🛡️ حفاظت‌های دیتابیس (بسیار مهم):
        - فقط فیلدهای **خالی** پر می‌شوند؛ هرگز روی داده‌ی واردشده‌ی انسان بازنویسی نمی‌شود.
        - **هیچ‌چیز حذف نمی‌شود**؛ فقط UPDATEِ مجموعه‌ی ثابتی از فیلدهای مجاز.
        - اطمینانِ پایین (< MIN) → هیچ تغییری اعمال نمی‌شود (داده‌ی مشکوک ننشیند).
        - رشته/پایه فقط اگر دقیقاً در فهرستِ مجاز باشند پذیرفته می‌شوند (ضدِ مقدارِ جعلی).
        - موبایل هرگز از AI نوشته نمی‌شود.
        - هر خطایی اینجا بی‌صدا رد می‌شود تا پایپ‌لاین نشکند.
        """
        if not student_id or extracted is None:
            return {"filled": {}}
        if (extracted.confidence or 0) < _MIN_AUTOFILL_CONFIDENCE:
            return {"filled": {}, "skipped": "low_confidence"}

        async with SessionLocal() as s:
            student = await s.get(Student, UUID(student_id))
            # فقط دانشجوی موجود و حذف‌نشده
            if student is None or student.deleted_at is not None:
                return {"filled": {}}

            filled: dict = {}

            def fill(attr: str, value, allowed: set | None = None) -> None:
                if not value:
                    return
                if allowed is not None and value not in allowed:
                    return  # مقدارِ خارج از فهرستِ مجاز را نادیده بگیر
                if getattr(student, attr):
                    return  # فقط فیلدِ خالی — هرگز بازنویسی نکن
                setattr(student, attr, value)
                filled[attr] = value

            fill("full_name", extracted.full_name)
            fill("goal", extracted.educational_goal)
            fill("field", extracted.study_field, _ALLOWED_FIELDS)
            fill("grade", extracted.grade, _ALLOWED_GRADES)
            fill("city", extracted.city)

            if filled:
                # ثبتِ Activity برای ردگیری (چه چیزی را AI پر کرد)
                s.add(Activity(student_id=student.id, type="ai_autofill",
                               payload={"by": "ai", **filled}))
                await s.commit()
            return {"filled": filled}

    async def get_recording(self, call_id: str) -> dict | None:
        async with SessionLocal() as s:
            rec = await s.scalar(select(Recording).where(Recording.call_id == UUID(call_id)))
            if rec and rec.storage_key:
                return {"storage_key": rec.storage_key}
            return None

    async def get_latest_analysis(self, call_id: str) -> dict | None:
        async with SessionLocal() as s:
            ls = await s.scalar(
                select(LeadScore).where(LeadScore.call_id == UUID(call_id))
                .order_by(LeadScore.created_at.desc()).limit(1)
            )
            if ls is None:
                return None
            return {"lead_score": ls.score,
                    "registration_probability": float(ls.registration_probability or 0),
                    "next_best_action": ls.next_best_action,
                    "signals": ls.signals}
