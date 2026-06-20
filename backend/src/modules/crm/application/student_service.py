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
    Followup,
    Note,
    Student,
)
from src.shared.errors.exceptions import ConflictError, NotFoundError


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
        await self._s.commit()

    async def change_stage(self, student_id: UUID, stage_id: UUID,
                           actor_id: str) -> StudentOut:
        student = await self._get_or_404(student_id)
        old = student.sales_stage_id
        student.sales_stage_id = stage_id
        self._s.add(Activity(student_id=student.id, type="stage_changed",
                             payload={"from": str(old), "to": str(stage_id)}))
        await self._s.commit()
        return StudentOut.model_validate(student)

    async def add_note(self, student_id: UUID, body: str, author_id: str) -> dict:
        await self._get_or_404(student_id)
        note = Note(student_id=student_id, author_id=author_id, body=body)
        self._s.add(note)
        await self._s.commit()
        return {"id": str(note.id), "status": "created"}

    async def list_followups(self, status, page, size, owner) -> Paginated:
        stmt = select(Followup)
        if status:
            stmt = stmt.where(Followup.status == status)
        total = await self._s.scalar(select(func.count()).select_from(stmt.subquery()))
        rows = (await self._s.execute(
            stmt.order_by(Followup.due_at).offset((page - 1) * size).limit(size)
        )).scalars().all()
        return Paginated(
            items=[{"id": str(f.id), "student_id": str(f.student_id),
                    "due_at": f.due_at.isoformat(), "status": f.status,
                    "note": f.note} for f in rows],
            total=total or 0, page=page, size=size,
        )

    async def create_followup(self, body: FollowupCreate, owner_id: str) -> dict:
        fu = Followup(student_id=body.student_id, owner_id=owner_id,
                      due_at=body.due_at, note=body.note)
        self._s.add(fu)
        await self._s.commit()
        return {"id": str(fu.id), "status": "created"}

    async def _get_or_404(self, student_id: UUID) -> Student:
        student = await self._s.scalar(
            select(Student).where(Student.id == student_id,
                                  Student.deleted_at.is_(None))
        )
        if student is None:
            raise NotFoundError("دانشجو یافت نشد")
        return student
