"""سرویس احراز هویت — ورود، تمدید توکن، ابطال."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.identity.infrastructure.models import User
from src.shared.errors.exceptions import AuthError
from src.shared.security.jwt import (
    create_access_token,
    create_refresh_token,
    decode_token,
)
from src.shared.security.password import verify_password


class AuthService:
    def __init__(self, session: AsyncSession, redis):
        self._session = session
        self._redis = redis

    async def login(self, email: str, password: str) -> dict:
        result = await self._session.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if user is None or not user.is_active or not verify_password(
            password, user.hashed_password
        ):
            raise AuthError("ایمیل یا رمز عبور نادرست است", code="AUTH_INVALID")

        roles = [r.name for r in user.roles]
        perms = sorted({p.code for r in user.roles for p in r.permissions})
        access = create_access_token(str(user.id), roles, perms,
                                     str(user.tenant_id) if user.tenant_id else None)
        refresh, jti = create_refresh_token(str(user.id))
        await self._redis.setex(f"refresh:{jti}", 604800, str(user.id))

        from src.shared.config.settings import get_settings
        return {
            "access_token": access,
            "refresh_token": refresh,
            "token_type": "bearer",
            "expires_in": get_settings().jwt_access_ttl,
        }

    async def refresh(self, refresh_token: str) -> dict:
        payload = decode_token(refresh_token)
        if payload.get("type") != "refresh":
            raise AuthError("نوع توکن نامعتبر است")
        jti = payload["jti"]
        stored = await self._redis.get(f"refresh:{jti}")
        if stored is None:
            raise AuthError("توکن باطل شده است", code="TOKEN_EXPIRED")
        # Rotation: باطل‌کردن توکن قبلی و صدور جدید
        await self._redis.delete(f"refresh:{jti}")
        return await self._issue_for_user(payload["sub"])

    async def logout(self, refresh_token: str) -> None:
        payload = decode_token(refresh_token)
        await self._redis.delete(f"refresh:{payload.get('jti')}")

    async def _issue_for_user(self, user_id: str) -> dict:
        result = await self._session.execute(select(User).where(User.id == user_id))
        user = result.scalar_one()
        roles = [r.name for r in user.roles]
        perms = sorted({p.code for r in user.roles for p in r.permissions})
        access = create_access_token(str(user.id), roles, perms)
        refresh, jti = create_refresh_token(str(user.id))
        await self._redis.setex(f"refresh:{jti}", 604800, str(user.id))
        from src.shared.config.settings import get_settings
        return {"access_token": access, "refresh_token": refresh,
                "token_type": "bearer", "expires_in": get_settings().jwt_access_ttl}
