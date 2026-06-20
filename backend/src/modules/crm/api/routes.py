"""Routerهای CRM — دانشجو، یادداشت، تگ، پیگیری، دوره (اسکلت با سرویس)."""
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.crm.api.schemas import (
    CourseCreate,
    CourseUpdate,
    FollowupCreate,
    NoteCreate,
    Paginated,
    StageChange,
    StageCreate,
    StudentCreate,
    StudentOut,
    StudentUpdate,
    TagAttach,
    TagCreate,
)
from src.modules.crm.application.catalog_service import CatalogService
from src.modules.crm.application.student_service import StudentService
from src.modules.identity.api.dependencies import current_user, require_permission
from src.shared.db.base import get_session

router = APIRouter()


# ---------- Students ----------
@router.get("/students", response_model=Paginated)
async def list_students(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    stage: UUID | None = None,
    agent: UUID | None = None,
    status: str | None = None,
    q: str | None = None,
    session: AsyncSession = Depends(get_session),
    user=Depends(require_permission("students:read")),
) -> Paginated:
    return await StudentService(session).list(page, size, stage, agent, status, q)


@router.post("/students", response_model=StudentOut, status_code=201)
async def create_student(
    body: StudentCreate,
    session: AsyncSession = Depends(get_session),
    user=Depends(require_permission("students:write")),
) -> StudentOut:
    return await StudentService(session).create(body, actor_id=user.id)


@router.get("/students/{student_id}", response_model=StudentOut)
async def get_student(
    student_id: UUID,
    session: AsyncSession = Depends(get_session),
    user=Depends(require_permission("students:read")),
) -> StudentOut:
    return await StudentService(session).get(student_id)


@router.patch("/students/{student_id}", response_model=StudentOut)
async def update_student(
    student_id: UUID,
    body: StudentUpdate,
    session: AsyncSession = Depends(get_session),
    user=Depends(require_permission("students:write")),
) -> StudentOut:
    return await StudentService(session).update(student_id, body, actor_id=user.id)


@router.delete("/students/{student_id}", status_code=204)
async def delete_student(
    student_id: UUID,
    session: AsyncSession = Depends(get_session),
    user=Depends(require_permission("students:write")),
) -> None:
    await StudentService(session).soft_delete(student_id, actor_id=user.id)


@router.post("/students/{student_id}/stage", response_model=StudentOut)
async def change_stage(
    student_id: UUID,
    body: StageChange,
    session: AsyncSession = Depends(get_session),
    user=Depends(require_permission("students:write")),
) -> StudentOut:
    return await StudentService(session).change_stage(student_id, body.sales_stage_id,
                                                      actor_id=user.id)


# ---------- Notes ----------
@router.post("/students/{student_id}/notes", status_code=201)
async def add_note(
    student_id: UUID,
    body: NoteCreate,
    session: AsyncSession = Depends(get_session),
    user=Depends(require_permission("students:write")),
) -> dict:
    return await StudentService(session).add_note(student_id, body.body, author_id=user.id)


# ---------- Followups ----------
@router.get("/followups", response_model=Paginated)
async def list_followups(
    status: str | None = None,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
    user=Depends(require_permission("followups:read")),
) -> Paginated:
    return await StudentService(session).list_followups(status, page, size, owner=user.id)


@router.post("/followups", status_code=201)
async def create_followup(
    body: FollowupCreate,
    session: AsyncSession = Depends(get_session),
    user=Depends(require_permission("followups:write")),
) -> dict:
    return await StudentService(session).create_followup(body, owner_id=user.id)


# ---------- Courses ----------
@router.get("/courses")
async def list_courses(
    session: AsyncSession = Depends(get_session),
    user=Depends(require_permission("students:read")),
) -> list[dict]:
    return await CatalogService(session).list_courses()


@router.post("/courses", status_code=201)
async def create_course(
    body: CourseCreate,
    session: AsyncSession = Depends(get_session),
    user=Depends(require_permission("courses:write")),
) -> dict:
    return await CatalogService(session).create_course(body.title, body.slug, body.price)


@router.patch("/courses/{course_id}")
async def update_course(
    course_id: UUID,
    body: CourseUpdate,
    session: AsyncSession = Depends(get_session),
    user=Depends(require_permission("courses:write")),
) -> dict:
    return await CatalogService(session).update_course(
        course_id, body.model_dump(exclude_unset=True)
    )


# ---------- Tags ----------
@router.get("/tags")
async def list_tags(
    session: AsyncSession = Depends(get_session),
    user=Depends(require_permission("students:read")),
) -> list[dict]:
    return await CatalogService(session).list_tags()


@router.post("/tags", status_code=201)
async def create_tag(
    body: TagCreate,
    session: AsyncSession = Depends(get_session),
    user=Depends(require_permission("students:write")),
) -> dict:
    return await CatalogService(session).create_tag(body.name, body.color)


@router.post("/students/{student_id}/tags", status_code=201)
async def attach_tag(
    student_id: UUID,
    body: TagAttach,
    session: AsyncSession = Depends(get_session),
    user=Depends(require_permission("students:write")),
) -> dict:
    return await CatalogService(session).attach_tag(student_id, body.tag_id)


# ---------- Sales Stages ----------
@router.get("/sales-stages")
async def list_stages(
    session: AsyncSession = Depends(get_session),
    user=Depends(require_permission("students:read")),
) -> list[dict]:
    return await CatalogService(session).list_stages(tenant_id=user.tenant_id)


@router.post("/sales-stages", status_code=201)
async def create_stage(
    body: StageCreate,
    session: AsyncSession = Depends(get_session),
    user=Depends(require_permission("students:write")),
) -> dict:
    return await CatalogService(session).create_stage(
        body.name, body.order_index, body.is_terminal, body.color,
        tenant_id=user.tenant_id,
    )
