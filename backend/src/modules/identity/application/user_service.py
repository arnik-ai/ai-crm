"""سرویس مدیریت کاربران (اعضای تیم) — فهرست، ایجاد، ویرایش، غیرفعال‌سازی.

برای کاربرانِ ورود-با-پیامک که ایمیل/رمز ندارند، یک ایمیل یکتای داخلی و رمز
تصادفیِ غیرقابل‌استفاده ساخته می‌شود تا محدودیت‌های جدول users نقض نشود؛
این کاربران فقط از طریق پیامک (OTP) وارد می‌شوند.
"""
import secrets

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.identity.api.schemas import _normalize_mobile
from src.modules.identity.infrastructure.models import Role, User
from src.shared.errors.exceptions import ConflictError, NotFoundError, ValidationError
from src.shared.security.audit import record_audit
from src.shared.security.password import hash_password

# نقش‌های مجاز برای تخصیص از پنل
ASSIGNABLE_ROLES = {"admin", "sales_manager", "sales_agent", "viewer"}


class UserService:
    def __init__(self, session: AsyncSession):
        self._s = session

    async def list_users(self) -> list[dict]:
        rows = (await self._s.execute(
            select(User).order_by(User.created_at.desc())
        )).scalars().all()
        return [self._to_dict(u) for u in rows]

    async def create_user(self, full_name: str, mobile: str, role: str,
                          email: str | None, password: str | None,
                          actor_id: str) -> dict:
        if role not in ASSIGNABLE_ROLES:
            raise ValidationError("نقش نامعتبر است")
        mobile = _normalize_mobile(mobile)

        # یکتایی موبایل
        exists = await self._s.scalar(select(User).where(User.mobile == mobile))
        if exists:
            raise ConflictError("کاربری با این موبایل وجود دارد", code="USER_DUPLICATE")

        # ایمیل: اگر داده نشده، یک ایمیل داخلی یکتا می‌سازیم
        final_email = (email or "").strip().lower()
        if final_email:
            dup = await self._s.scalar(select(User).where(User.email == final_email))
            if dup:
                raise ConflictError("این ایمیل قبلاً ثبت شده", code="EMAIL_DUPLICATE")
        else:
            digits = "".join(ch for ch in mobile if ch.isdigit())
            final_email = f"{digits}@otp.local"

        # رمز: اگر داده نشده، رمز تصادفیِ غیرقابل‌استفاده (ورود فقط با پیامک)
        raw_password = password or secrets.token_urlsafe(24)

        role_obj = await self._s.scalar(select(Role).where(Role.name == role))
        if role_obj is None:
            raise NotFoundError("نقش یافت نشد؛ ابتدا seed را اجرا کنید")

        user = User(
            full_name=full_name, mobile=mobile, email=final_email,
            hashed_password=hash_password(raw_password), is_active=True,
        )
        user.roles = [role_obj]
        self._s.add(user)
        await self._s.flush()
        await record_audit(self._s, actor_id=actor_id, action="create",
                           entity="user", entity_id=str(user.id),
                           diff={"mobile": mobile, "role": role})
        await self._s.commit()
        return self._to_dict(user)

    async def update_user(self, user_id: str, data: dict, actor_id: str) -> dict:
        user = await self._s.get(User, user_id)
        if user is None:
            raise NotFoundError("کاربر یافت نشد")

        if "full_name" in data and data["full_name"] is not None:
            user.full_name = data["full_name"]
        if "is_active" in data and data["is_active"] is not None:
            user.is_active = bool(data["is_active"])
        if data.get("mobile"):
            new_mobile = _normalize_mobile(data["mobile"])
            if new_mobile != user.mobile:
                dup = await self._s.scalar(
                    select(User).where(User.mobile == new_mobile, User.id != user.id)
                )
                if dup:
                    raise ConflictError("موبایل تکراری است", code="USER_DUPLICATE")
                user.mobile = new_mobile
        if data.get("role"):
            if data["role"] not in ASSIGNABLE_ROLES:
                raise ValidationError("نقش نامعتبر است")
            role_obj = await self._s.scalar(
                select(Role).where(Role.name == data["role"])
            )
            if role_obj is None:
                raise NotFoundError("نقش یافت نشد")
            user.roles = [role_obj]

        await record_audit(self._s, actor_id=actor_id, action="update",
                           entity="user", entity_id=str(user.id), diff=data)
        await self._s.commit()
        return self._to_dict(user)

    async def set_active(self, user_id: str, active: bool, actor_id: str) -> dict:
        return await self.update_user(user_id, {"is_active": active}, actor_id)

    @staticmethod
    def _to_dict(u: User) -> dict:
        return {
            "id": str(u.id),
            "full_name": u.full_name,
            "mobile": u.mobile,
            "email": u.email,
            "is_active": u.is_active,
            "roles": [r.name for r in u.roles],
        }
