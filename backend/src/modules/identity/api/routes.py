"""Routerهای احراز هویت."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.identity.api.dependencies import current_user
from src.modules.identity.api.schemas import (
    CurrentUser,
    LoginRequest,
    RefreshRequest,
    TokenResponse,
)
from src.modules.identity.application.auth_service import AuthService
from src.shared.db.base import get_session
from src.shared.db.redis_client import get_redis
from src.shared.security.rate_limit import login_rate_limiter

router = APIRouter()


@router.post("/login", response_model=TokenResponse,
             dependencies=[Depends(login_rate_limiter())])
async def login(
    body: LoginRequest,
    session: AsyncSession = Depends(get_session),
    redis=Depends(get_redis),
) -> TokenResponse:
    service = AuthService(session, redis)
    return TokenResponse(**await service.login(body.email, body.password))


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    body: RefreshRequest,
    session: AsyncSession = Depends(get_session),
    redis=Depends(get_redis),
) -> TokenResponse:
    service = AuthService(session, redis)
    return TokenResponse(**await service.refresh(body.refresh_token))


@router.post("/logout")
async def logout(
    body: RefreshRequest,
    session: AsyncSession = Depends(get_session),
    redis=Depends(get_redis),
) -> dict:
    await AuthService(session, redis).logout(body.refresh_token)
    return {"status": "ok"}


@router.get("/me", response_model=CurrentUser)
async def me(user: CurrentUser = Depends(current_user)) -> CurrentUser:
    return user
