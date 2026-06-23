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
        access = create_access_token(
            str(user.id), roles, perms,
            str(user.tenant_id) if user.tenant_id else None,
            email=user.email, full_name=user.full_name,
        )
        refresh, jti = create_refresh_token(str(user.id))
        await self._redis.setex(f"refresh:{jti}", 604800, str(user.id))

        from src.shared.config.settings import get_settings
        return {
            "access_token": access,
            "refresh_token": refresh,
            "token_type": "bearer",
            "expires_in": get_settings().jwt_access_ttl,
        }

    async def request_otp(self, mobile: str) -> dict:
        """برای کاربرِ دارایِ این موبایل، کد می‌سازد و پیامک می‌کند.

        برای جلوگیری از افشای اینکه چه شماره‌هایی کاربر هستند (user enumeration)،
        حتی اگر کاربر پیدا نشود پاسخِ موفق برمی‌گردد ولی پیامکی ارسال نمی‌شود.
        """
        from src.modules.identity.application.otp_service import OtpService
        from src.modules.identity.infrastructure.sms.factory import get_sms_provider

        result = await self._session.execute(
            select(User).where(User.mobile == mobile, User.is_active.is_(True))
        )
        user = result.scalar_one_or_none()

        debug_code = None
        if user is not None:
            otp = OtpService(self._redis)
            code = await otp.generate(mobile)
            provider = get_sms_provider()
            await provider.send_otp(mobile, code)
            if provider.returns_debug_code:
                debug_code = code  # فقط در حالت تستی (console)

        from src.shared.config.settings import get_settings
        return {"sent": True, "cooldown": get_settings().otp_request_cooldown,
                "debug_code": debug_code}

    async def login_with_otp(self, mobile: str, code: str) -> dict:
        """ورود با کد پیامکی: بررسی کد و صدور توکن برای کاربرِ آن موبایل."""
        from src.modules.identity.application.otp_service import OtpService

        otp = OtpService(self._redis)
        if not await otp.verify(mobile, code):
            raise AuthError("کد واردشده نادرست است", code="OTP_INVALID")

        result = await self._session.execute(
            select(User).where(User.mobile == mobile, User.is_active.is_(True))
        )
        user = result.scalar_one_or_none()
        if user is None:
            raise AuthError("کاربری با این شماره یافت نشد", code="USER_NOT_FOUND")
        return await self._issue_for_user(str(user.id))

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
        access = create_access_token(
            str(user.id), roles, perms,
            str(user.tenant_id) if user.tenant_id else None,
            email=user.email, full_name=user.full_name,
        )
        refresh, jti = create_refresh_token(str(user.id))
        await self._redis.setex(f"refresh:{jti}", 604800, str(user.id))
        from src.shared.config.settings import get_settings
        return {"access_token": access, "refresh_token": refresh,
                "token_type": "bearer", "expires_in": get_settings().jwt_access_ttl}
