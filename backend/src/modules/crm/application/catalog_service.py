"""سرویس دوره‌ها (Courses)، تگ‌ها (Tags) و مراحل فروش (Sales Stages)."""
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.crm.infrastructure.models import (
    Course,
    SalesStage,
    Student,
    Tag,
    student_tags,
)
from src.shared.errors.exceptions import ConflictError, NotFoundError


class CatalogService:
    def __init__(self, session: AsyncSession):
        self._s = session

    # ---------- Courses ----------
    async def list_courses(self) -> list[dict]:
        rows = (await self._s.execute(
            select(Course).order_by(Course.title)
        )).scalars().all()
        return [{"id": str(c.id), "title": c.title, "slug": c.slug,
                 "price": float(c.price) if c.price is not None else None,
                 "is_active": c.is_active} for c in rows]

    async def create_course(self, title: str, slug: str,
                            price: float | None) -> dict:
        exists = await self._s.scalar(select(Course).where(Course.slug == slug))
        if exists:
            raise ConflictError("دوره با این slug وجود دارد", code="COURSE_DUPLICATE")
        course = Course(title=title, slug=slug, price=price)
        self._s.add(course)
        await self._s.commit()
        return {"id": str(course.id), "title": course.title, "slug": course.slug}

    async def update_course(self, course_id: UUID, data: dict) -> dict:
        course = await self._s.get(Course, course_id)
        if course is None:
            raise NotFoundError("دوره یافت نشد")
        for k, v in data.items():
            setattr(course, k, v)
        await self._s.commit()
        return {"id": str(course.id), "title": course.title}

    # ---------- Tags ----------
    async def list_tags(self) -> list[dict]:
        rows = (await self._s.execute(select(Tag).order_by(Tag.name))).scalars().all()
        return [{"id": str(t.id), "name": t.name, "color": t.color} for t in rows]

    async def create_tag(self, name: str, color: str) -> dict:
        exists = await self._s.scalar(select(Tag).where(Tag.name == name))
        if exists:
            raise ConflictError("تگ تکراری است", code="TAG_DUPLICATE")
        tag = Tag(name=name, color=color)
        self._s.add(tag)
        await self._s.commit()
        return {"id": str(tag.id), "name": tag.name, "color": tag.color}

    async def attach_tag(self, student_id: UUID, tag_id: UUID) -> dict:
        student = await self._s.get(Student, student_id)
        if student is None:
            raise NotFoundError("دانشجو یافت نشد")
        tag = await self._s.get(Tag, tag_id)
        if tag is None:
            raise NotFoundError("تگ یافت نشد")
        # درج idempotent در جدول واسط (در صورت وجود، نادیده)
        await self._s.execute(
            pg_insert(student_tags)
            .values(student_id=student_id, tag_id=tag_id)
            .on_conflict_do_nothing(index_elements=["student_id", "tag_id"])
        )
        await self._s.commit()
        return {"status": "attached"}

    # ---------- Sales Stages ----------
    async def list_stages(self, tenant_id: str | None) -> list[dict]:
        rows = (await self._s.execute(
            select(SalesStage).order_by(SalesStage.order_index)
        )).scalars().all()
        return [{"id": str(s.id), "name": s.name, "order_index": s.order_index,
                 "is_terminal": s.is_terminal, "color": s.color} for s in rows]

    async def create_stage(self, name: str, order_index: int, is_terminal: bool,
                           color: str, tenant_id: str | None) -> dict:
        stage = SalesStage(
            name=name, order_index=order_index, is_terminal=is_terminal,
            color=color, tenant_id=UUID(tenant_id) if tenant_id else None,
        )
        self._s.add(stage)
        await self._s.commit()
        return {"id": str(stage.id), "name": stage.name}
