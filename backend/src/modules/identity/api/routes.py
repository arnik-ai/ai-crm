"""Routerهای احراز هویت."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.identity.api.dependencies import current_user
from src.modules.identity.api.schemas import (
    CurrentUser,
    LoginRequest,
    OtpRequest,
    OtpRequestResponse,
    OtpVerify,
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


@router.post("/otp/request", response_model=OtpRequestResponse,
             dependencies=[Depends(login_rate_limiter())])
async def request_otp(
    body: OtpRequest,
    session: AsyncSession = Depends(get_session),
    redis=Depends(get_redis),
) -> OtpRequestResponse:
    """درخواست کد ورود پیامکی برای یک شماره‌ی موبایل."""
    service = AuthService(session, redis)
    return OtpRequestResponse(**await service.request_otp(body.mobile))


@router.post("/otp/verify", response_model=TokenResponse,
             dependencies=[Depends(login_rate_limiter())])
async def verify_otp(
    body: OtpVerify,
    session: AsyncSession = Depends(get_session),
    redis=Depends(get_redis),
) -> TokenResponse:
    """بررسی کد پیامکی و ورود."""
    service = AuthService(session, redis)
    return TokenResponse(**await service.login_with_otp(body.mobile, body.code))


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
