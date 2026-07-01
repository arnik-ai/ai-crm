"""سرویس دامنه‌ی دانشجو — منطق CRUD، تغییر مرحله، یادداشت و پیگیری."""
from uuid import UUID

from sqlalchemy import and_, exists, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.crm.api.schemas import (
    FollowupCreate,
    Paginated,
    StudentCreate,
    StudentOut,
    StudentUpdate,
    _normalize_mobile,
)
from src.modules.crm.infrastructure.models import (
    Activity,
    Course,
    Followup,
    Message,
    Note,
    Sale,
    SalesStage,
    Student,
)
from src.modules.identity.infrastructure.models import User
from src.modules.telephony.infrastructure.models import Call
from src.shared.errors.exceptions import ConflictError, NotFoundError
from src.shared.security.audit import record_audit


class StudentService:
    def __init__(self, session: AsyncSession):
        self._s = session

    async def list(self, page, size, stage, agent, status, q, today=False) -> Paginated:
        # تعداد تماس هر دانشجو (با شماره‌ی موبایلش) تا کنار نام دیده شود.
        call_count = (
            select(func.count(Call.id))
            .where(Call.student_id == Student.id)
            .correlate(Student).scalar_subquery()
        )
        # نامِ مشاورِ تخصیص‌یافته (برای نمایش)
        advisor_name = (
            select(User.full_name)
            .where(User.id == Student.assigned_agent_id)
            .correlate(Student).scalar_subquery()
        )
        stmt = select(
            Student, call_count.label("call_count"), advisor_name.label("advisor_name")
        ).where(Student.deleted_at.is_(None))
        if stage:
            stmt = stmt.where(Student.sales_stage_id == stage)
        if agent:
            # مشاور = فقط دانشجویانِ تخصیص‌یافته به خودش (scope از روت تعیین می‌شود)
            stmt = stmt.where(Student.assigned_agent_id == agent)
        if status:
            stmt = stmt.where(Student.status == status)
        if q:
            like = f"%{q}%"
            stmt = stmt.where(Student.full_name.ilike(like) | Student.mobile.ilike(like))
        if today:
            # ابتدای امروز به وقتِ تهران (UTC+3:30) → تبدیل به UTC برای مقایسه
            from datetime import datetime, timedelta, timezone
            tehran = timezone(timedelta(hours=3, minutes=30))
            start = (datetime.now(tehran)
                     .replace(hour=0, minute=0, second=0, microsecond=0)
                     .astimezone(timezone.utc))
            stmt = stmt.where(Student.created_at >= start)

        # جدیدترین‌ها ابتدا (هم برای «امروز» و هم صفحه‌بندیِ پایدار)
        stmt = stmt.order_by(Student.created_at.desc())

        total = await self._s.scalar(
            select(func.count()).select_from(stmt.subquery())
        )
        rows = (
            await self._s.execute(stmt.offset((page - 1) * size).limit(size))
        ).all()
        items = []
        for student, cc, adv in rows:
            data = StudentOut.model_validate(student).model_dump()
            data["call_count"] = int(cc or 0)
            data["advisor_name"] = adv
            items.append(data)
        return Paginated(items=items, total=total or 0, page=page, size=size)

    async def create(self, body: StudentCreate, actor_id: str) -> StudentOut:
        existing = await self._s.scalar(
            select(Student).where(Student.mobile == body.mobile,
                                  Student.deleted_at.is_(None))
        )
        if existing:
            raise ConflictError("دانشجو با این شماره موبایل وجود دارد",
                                code="STUDENT_DUPLICATE")
        student = Student(
            full_name=body.full_name, mobile=body.mobile,
            city=body.city, field=body.field, grade=body.grade,
            goal=body.goal, gpa=body.gpa,
            course_interest_id=body.course_interest_id,
            lead_source=body.lead_source,
            # اگر مشاورِ مشخصی داده نشده، سرنخ به سازنده‌اش تخصیص می‌یابد
            # (تا کارشناس سرنخِ خودش را در «سرنخ‌های امروز» ببیند).
            assigned_agent_id=body.assigned_agent_id or actor_id,
        )
        self._s.add(student)
        await self._s.flush()
        self._s.add(Activity(student_id=student.id, type="created",
                             payload={"by": actor_id}))
        await record_audit(self._s, actor_id=actor_id, action="create",
                           entity="student", entity_id=str(student.id),
                           diff={"mobile": student.mobile})
        await self._s.commit()
        return StudentOut.model_validate(student)

    async def get(self, student_id: UUID) -> StudentOut:
        student = await self._get_or_404(student_id)
        return StudentOut.model_validate(student)

    async def update(self, student_id: UUID, body: StudentUpdate,
                     actor_id: str) -> StudentOut:
        student = await self._get_or_404(student_id)
        for field, value in body.model_dump(exclude_unset=True).items():
            setattr(student, field, value)
        await self._s.commit()
        return StudentOut.model_validate(student)

    async def soft_delete(self, student_id: UUID, actor_id: str) -> None:
        from datetime import datetime, timezone
        student = await self._get_or_404(student_id)
        student.deleted_at = datetime.now(tz=timezone.utc)
        await record_audit(self._s, actor_id=actor_id, action="delete",
                           entity="student", entity_id=str(student_id))
        await self._s.commit()

    async def change_stage(self, student_id: UUID, stage_id: UUID,
                           actor_id: str) -> StudentOut:
        student = await self._get_or_404(student_id)
        old = student.sales_stage_id
        student.sales_stage_id = stage_id
        self._s.add(Activity(student_id=student.id, type="stage_changed",
                             payload={"from": str(old), "to": str(stage_id)}))
        await record_audit(self._s, actor_id=actor_id, action="change_stage",
                           entity="student", entity_id=str(student_id),
                           diff={"from": str(old), "to": str(stage_id)})
        await self._s.commit()
        return StudentOut.model_validate(student)

    async def add_note(self, student_id: UUID, body: str, author_id: str) -> dict:
        await self._get_or_404(student_id)
        note = Note(student_id=student_id, author_id=author_id, body=body)
        self._s.add(note)
        await self._s.commit()
        return {"id": str(note.id), "status": "created"}

    async def list_followups(self, status, page, size, owner) -> Paginated:
        # join با Student تا نام و موبایل دانشجو برای نمایش در UI همراه شود.
        stmt = (
            select(
                Followup.id, Followup.student_id, Followup.due_at,
                Followup.status, Followup.note,
                Student.full_name, Student.mobile,
            )
            .join(Student, Student.id == Followup.student_id)
        )
        if status:
            stmt = stmt.where(Followup.status == status)
        else:
            # به‌صورتِ پیش‌فرض، پیگیری‌های «انجام‌شده» در لیست نمایش داده نمی‌شوند
            stmt = stmt.where(Followup.status != "done")
        total = await self._s.scalar(select(func.count()).select_from(stmt.subquery()))
        rows = (await self._s.execute(
            stmt.order_by(Followup.due_at).offset((page - 1) * size).limit(size)
        )).all()
        return Paginated(
            items=[{
                "id": str(r.id),
                "student_id": str(r.student_id),
                "student_name": r.full_name,
                "mobile": r.mobile,
                "due_at": r.due_at.isoformat(),
                "next_call": r.due_at.isoformat(),
                "status": r.status,
                "note": r.note,
            } for r in rows],
            total=total or 0, page=page, size=size,
        )

    async def create_followup(self, body: FollowupCreate, owner_id: str) -> dict:
        fu = Followup(student_id=body.student_id, owner_id=owner_id,
                      due_at=body.due_at, note=body.note)
        self._s.add(fu)
        await self._s.commit()
        return {"id": str(fu.id), "status": "created"}

    async def set_followup_status(self, followup_id: UUID, status: str,
                                  actor_id: str) -> dict:
        fu = await self._s.get(Followup, followup_id)
        if fu is None:
            raise NotFoundError("پیگیری یافت نشد")
        fu.status = status
        await self._s.commit()
        return {"id": str(fu.id), "status": fu.status}

    async def delete_followup(self, followup_id: UUID, actor_id: str) -> dict:
        fu = await self._s.get(Followup, followup_id)
        if fu is None:
            raise NotFoundError("پیگیری یافت نشد")
        await self._s.delete(fu)
        await self._s.commit()
        return {"status": "deleted"}

    async def list_sales(self, page, size) -> dict:
        """لیست فروش = دانشجویانی که به مرحله‌ی ترمینالِ ثبت‌نام رسیده‌اند.

        پروژه جدول مستقل فروش ندارد؛ «فروش» را از مرحله‌ی فروشِ دانشجو استخراج
        می‌کنیم: مرحله‌ی ترمینال که «Lost/ازدست‌رفته» نباشد یعنی ثبت‌نام موفق.
        مبلغ از قیمت دوره‌ی موردعلاقه می‌آید (در صورت وجود).
        """
        stmt = (
            select(
                Student.id, Student.full_name, Student.mobile,
                Student.created_at,
                SalesStage.name.label("stage_name"),
                Course.title.label("course_title"),
                Course.price.label("course_price"),
            )
            .join(SalesStage, SalesStage.id == Student.sales_stage_id)
            .outerjoin(Course, Course.id == Student.course_interest_id)
            .where(
                Student.deleted_at.is_(None),
                SalesStage.is_terminal.is_(True),
                SalesStage.name.notin_(["Lost", "ازدست‌رفته"]),
            )
            .order_by(Student.created_at.desc())
        )
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total_count = await self._s.scalar(count_stmt) or 0
        rows = (await self._s.execute(
            stmt.offset((page - 1) * size).limit(size)
        )).all()

        items = []
        total_amount = 0.0
        for r in rows:
            amount = float(r.course_price) if r.course_price is not None else 0.0
            total_amount += amount
            items.append({
                "id": str(r.id),
                "student_name": r.full_name,
                "mobile": r.mobile,
                "date": r.created_at.isoformat(),
                "course": r.course_title,
                "product": r.stage_name,
                "amount": amount,
                "payment": None,  # پروژه هنوز نوع پرداخت را ذخیره نمی‌کند
            })
        return {
            "items": items,
            "total_amount": total_amount,
            "count": total_count,
            "page": page,
            "size": size,
        }

    # ---------- Export (خروجی اکسل کامل) ----------
    def export_students_query(self):
        """کوئری همه‌ی دانشجویان (بدون صفحه‌بندی) برای خروجی استریم‌شده."""
        return (
            select(
                Student.full_name, Student.mobile, Student.city,
                Student.field, Student.grade, Student.goal,
                Student.lead_source, Student.status,
                SalesStage.name.label("stage"),
            )
            .outerjoin(SalesStage, SalesStage.id == Student.sales_stage_id)
            .where(Student.deleted_at.is_(None))
            .order_by(Student.created_at.desc())
        )

    def export_followups_query(self):
        """کوئری همه‌ی پیگیری‌ها (بدون صفحه‌بندی) برای خروجی استریم‌شده."""
        return (
            select(
                Student.full_name.label("student_name"),
                Student.mobile,
                Followup.due_at,
                Followup.status,
                Followup.note,
            )
            .join(Student, Student.id == Followup.student_id)
            .order_by(Followup.due_at.desc())
        )

    def export_sales_query(self):
        """کوئری همه‌ی فروش‌ها (دانشجویان ثبت‌نام‌شده) برای خروجی استریم‌شده."""
        return (
            select(
                Student.full_name.label("student_name"),
                Student.mobile,
                Student.created_at,
                Course.title.label("course"),
                SalesStage.name.label("product"),
                Course.price.label("amount"),
            )
            .join(SalesStage, SalesStage.id == Student.sales_stage_id)
            .outerjoin(Course, Course.id == Student.course_interest_id)
            .where(
                Student.deleted_at.is_(None),
                SalesStage.is_terminal.is_(True),
                SalesStage.name.notin_(["Lost", "ازدست‌رفته"]),
            )
            .order_by(Student.created_at.desc())
        )

    async def list_incomplete(self, page: int = 1, size: int = 50) -> dict:
        """گزارش «اطلاعات ناقص» (صفحه‌بندی‌شده): هر دانشجو چه چیزی کم دارد.

        موارد بررسی‌شده: نام، رشته، پایه، هدف، معدل، پیامک سامانه‌ای،
        پیام واتساپ/تلگرام، و توضیحات (یادداشت). شرطِ «ناقص‌بودن» در SQL اعمال
        می‌شود تا شمارش و صفحه‌بندی دقیق باشد.
        """
        has_note = exists().where(Note.student_id == Student.id)
        has_sms = exists().where(Message.student_id == Student.id,
                                 Message.channel == "sms")
        has_wa = exists().where(Message.student_id == Student.id,
                                Message.channel == "whatsapp")
        has_tg = exists().where(Message.student_id == Student.id,
                                Message.channel == "telegram")
        # «ناقص» = حداقل یکی از این‌ها خالی/نبود
        incomplete_cond = or_(
            Student.full_name.is_(None), Student.full_name == "",
            Student.field.is_(None),
            Student.grade.is_(None),
            Student.goal.is_(None),
            Student.gpa.is_(None),
            ~has_sms,
            and_(~has_wa, ~has_tg),
            ~has_note,
        )
        base = (
            select(
                Student.id, Student.full_name, Student.mobile, Student.field,
                Student.grade, Student.goal, Student.gpa,
                has_note.label("has_note"), has_sms.label("has_sms"),
                has_wa.label("has_wa"), has_tg.label("has_tg"),
            )
            .where(Student.deleted_at.is_(None), incomplete_cond)
        )
        total = await self._s.scalar(
            select(func.count()).select_from(base.subquery())
        ) or 0
        rows = (await self._s.execute(
            base.order_by(Student.created_at.desc())
            .offset((page - 1) * size).limit(size)
        )).all()

        items = []
        for r in rows:
            missing = []
            if not r.full_name:
                missing.append("نام و نام خانوادگی")
            if not r.field:
                missing.append("رشته")
            if not r.grade:
                missing.append("پایه")
            if not r.goal:
                missing.append("هدف")
            if r.gpa is None:
                missing.append("معدل")
            if not r.has_sms:
                missing.append("پیامک سامانه‌ای")
            if not r.has_wa and not r.has_tg:
                missing.append("پیام واتساپ/تلگرام")
            if not r.has_note:
                missing.append("توضیحات")
            if missing:
                items.append({
                    "id": str(r.id),
                    "full_name": r.full_name,
                    "mobile": r.mobile,
                    "missing": missing,
                })
        return {"items": items, "total": total, "count": total,
                "page": page, "size": size}

    async def lookup_by_mobile(self, mobile: str) -> dict:
        """جست‌وجوی موبایل: آیا از قبل ثبت شده؟ نام، تاریخ ثبت و خریدهای قبلی.

        برای: پرکردنِ خودکارِ نام، هشدارِ «تکراری» در «کارهای روز»، و پیامِ
        «دوباره فروختی» در «ثبت فیش».
        """
        m = _normalize_mobile(mobile)
        student = await self._s.scalar(
            select(Student).where(Student.mobile == m, Student.deleted_at.is_(None))
        )
        if student is None:
            return {"exists": False, "mobile": m}
        sale_rows = (await self._s.execute(
            select(Sale.product, Sale.amount, Sale.sold_at)
            .where((Sale.student_id == student.id) | (Sale.mobile == m))
            .order_by(Sale.sold_at.desc())
        )).all()
        return {
            "exists": True,
            "mobile": m,
            "student_id": str(student.id),
            "student_name": student.full_name,
            "created_at": student.created_at.isoformat() if student.created_at else None,
            "purchase_count": len(sale_rows),
            "purchases": [
                {"product": p, "amount": float(a) if a is not None else 0.0,
                 "date": d.isoformat() if d else None}
                for p, a, d in sale_rows
            ],
        }

    async def find_or_create_by_mobile(
        self, mobile: str, full_name: str | None = None,
        lead_source: str | None = None
    ) -> Student:
        """دانشجو را با موبایل پیدا می‌کند؛ اگر نبود می‌سازد (برای ثبت فیش/تماس)."""
        existing = await self._s.scalar(
            select(Student).where(Student.mobile == mobile,
                                  Student.deleted_at.is_(None))
        )
        if existing:
            # تکمیل نام در صورت خالی‌بودن
            if full_name and not existing.full_name:
                existing.full_name = full_name
            return existing
        student = Student(full_name=full_name, mobile=mobile,
                          lead_source=lead_source)
        self._s.add(student)
        await self._s.flush()
        return student

    async def _get_or_404(self, student_id: UUID) -> Student:
        student = await self._s.scalar(
            select(Student).where(Student.id == student_id,
                                  Student.deleted_at.is_(None))
        )
        if student is None:
            raise NotFoundError("دانشجو یافت نشد")
        return student
