"""Dependencyهای احراز هویت و RBAC."""
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from src.modules.identity.api.schemas import CurrentUser
from src.shared.errors.exceptions import AuthError, ForbiddenError
from src.shared.security.jwt import decode_token

_bearer = HTTPBearer(auto_error=False)


async def current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> CurrentUser:
    if creds is None:
        raise AuthError("توکن ارائه نشده است")
    payload = decode_token(creds.credentials)
    if payload.get("type") != "access":
        raise AuthError("نوع توکن نامعتبر است")
    return CurrentUser(
        id=payload["sub"],
        email=payload.get("email", ""),
        full_name=payload.get("full_name", ""),
        roles=payload.get("roles", []),
        permissions=payload.get("perms", []),
        tenant_id=payload.get("tenant_id"),
    )


def require_permission(perm: str):
    """Guard مبتنی بر مجوز (RBAC)."""

    async def guard(user: CurrentUser = Depends(current_user)) -> CurrentUser:
        if perm not in user.permissions and "admin" not in user.roles:
            raise ForbiddenError(f"دسترسی لازم نیست: {perm}")
        return user

    return guard
