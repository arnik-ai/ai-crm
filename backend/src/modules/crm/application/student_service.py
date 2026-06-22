"""سرویس دامنه‌ی دانشجو — منطق CRUD، تغییر مرحله، یادداشت و پیگیری."""
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.crm.api.schemas import (
    FollowupCreate,
    Paginated,
    StudentCreate,
    StudentOut,
    StudentUpdate,
)
from src.modules.crm.infrastructure.models import (
    Activity,
    Course,
    Followup,
    Note,
    SalesStage,
    Student,
)
from src.shared.errors.exceptions import ConflictError, NotFoundError
from src.shared.security.audit import record_audit


class StudentService:
    def __init__(self, session: AsyncSession):
        self._s = session

    async def list(self, page, size, stage, agent, status, q) -> Paginated:
        stmt = select(Student).where(Student.deleted_at.is_(None))
        if stage:
            stmt = stmt.where(Student.sales_stage_id == stage)
        if agent:
            stmt = stmt.where(Student.assigned_agent_id == agent)
        if status:
            stmt = stmt.where(Student.status == status)
        if q:
            like = f"%{q}%"
            stmt = stmt.where(Student.full_name.ilike(like) | Student.mobile.ilike(like))

        total = await self._s.scalar(
            select(func.count()).select_from(stmt.subquery())
        )
        rows = (
            await self._s.execute(stmt.offset((page - 1) * size).limit(size))
        ).scalars().all()
        return Paginated(
            items=[StudentOut.model_validate(r) for r in rows],
            total=total or 0, page=page, size=size,
        )

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
            course_interest_id=body.course_interest_id,
            lead_source=body.lead_source, assigned_agent_id=body.assigned_agent_id,
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

    async def _get_or_404(self, student_id: UUID) -> Student:
        student = await self._s.scalar(
            select(Student).where(Student.id == student_id,
                                  Student.deleted_at.is_(None))
        )
        if student is None:
            raise NotFoundError("دانشجو یافت نشد")
        return student
