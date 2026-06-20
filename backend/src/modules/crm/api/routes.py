"""Routerهای CRM — دانشجو، یادداشت، تگ، پیگیری، دوره (اسکلت با سرویس)."""
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.crm.api.schemas import (
    FollowupCreate,
    NoteCreate,
    Paginated,
    StageChange,
    StudentCreate,
    StudentOut,
    StudentUpdate,
)
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
