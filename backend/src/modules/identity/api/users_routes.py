"""Routerهای مدیریت کاربران (اعضای تیم) — فقط برای مدیر/ادمین."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.identity.api.dependencies import require_permission
from src.modules.identity.api.schemas import UserCreate, UserOut, UserUpdate
from src.modules.identity.application.user_service import UserService
from src.shared.db.base import get_session

router = APIRouter()


@router.get("", response_model=list[UserOut])
async def list_users(
    session: AsyncSession = Depends(get_session),
    user=Depends(require_permission("users:read")),
) -> list[UserOut]:
    rows = await UserService(session).list_users()
    return [UserOut(**r) for r in rows]


@router.post("", response_model=UserOut, status_code=201)
async def create_user(
    body: UserCreate,
    session: AsyncSession = Depends(get_session),
    user=Depends(require_permission("users:write")),
) -> UserOut:
    created = await UserService(session).create_user(
        full_name=body.full_name, mobile=body.mobile, role=body.role,
        email=body.email, password=body.password, actor_id=user.id,
    )
    return UserOut(**created)


@router.patch("/{user_id}", response_model=UserOut)
async def update_user(
    user_id: str,
    body: UserUpdate,
    session: AsyncSession = Depends(get_session),
    user=Depends(require_permission("users:write")),
) -> UserOut:
    updated = await UserService(session).update_user(
        user_id, body.model_dump(exclude_unset=True), actor_id=user.id
    )
    return UserOut(**updated)


@router.post("/{user_id}/deactivate", response_model=UserOut)
async def deactivate_user(
    user_id: str,
    session: AsyncSession = Depends(get_session),
    user=Depends(require_permission("users:write")),
) -> UserOut:
    updated = await UserService(session).set_active(user_id, False, actor_id=user.id)
    return UserOut(**updated)


@router.post("/{user_id}/activate", response_model=UserOut)
async def activate_user(
    user_id: str,
    session: AsyncSession = Depends(get_session),
    user=Depends(require_permission("users:write")),
) -> UserOut:
    updated = await UserService(session).set_active(user_id, True, actor_id=user.id)
    return UserOut(**updated)
