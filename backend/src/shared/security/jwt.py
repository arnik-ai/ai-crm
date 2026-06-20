"""ابزار JWT — صدور و اعتبارسنجی access/refresh token."""
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from jose import JWTError, jwt

from src.shared.config.settings import get_settings
from src.shared.errors.exceptions import AuthError

settings = get_settings()


def _now() -> datetime:
    return datetime.now(tz=timezone.utc)


def create_access_token(sub: str, roles: list[str], permissions: list[str],
                        tenant_id: str | None = None,
                        email: str = "", full_name: str = "") -> str:
    payload = {
        "sub": sub,
        "email": email,
        "full_name": full_name,
        "roles": roles,
        "perms": permissions,
        "tenant_id": tenant_id,
        "type": "access",
        "exp": _now() + timedelta(seconds=settings.jwt_access_ttl),
        "iat": _now(),
        "jti": str(uuid4()),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


def create_refresh_token(sub: str) -> tuple[str, str]:
    """برمی‌گرداند (token, jti) — jti برای ذخیره/ابطال در Redis."""
    jti = str(uuid4())
    payload = {
        "sub": sub,
        "type": "refresh",
        "exp": _now() + timedelta(seconds=settings.jwt_refresh_ttl),
        "iat": _now(),
        "jti": jti,
    }
    token = jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)
    return token, jti


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.secret_key, algorithms=[settings.jwt_algorithm])
    except JWTError as exc:
        raise AuthError("توکن نامعتبر یا منقضی است", code="TOKEN_EXPIRED") from exc
