"""Pydantic schemas برای Auth."""
from pydantic import BaseModel, EmailStr, Field, field_validator


def _normalize_mobile(v: str) -> str:
    v = v.strip().replace(" ", "").replace("-", "")
    if v.startswith("00"):
        v = "+" + v[2:]
    if v.startswith("0"):
        v = "+98" + v[1:]
    elif not v.startswith("+"):
        v = "+" + v
    return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)


class OtpRequest(BaseModel):
    mobile: str = Field(pattern=r"^[\d+\-\s]{8,20}$")

    @field_validator("mobile")
    @classmethod
    def norm(cls, v: str) -> str:
        return _normalize_mobile(v)


class OtpVerify(BaseModel):
    mobile: str = Field(pattern=r"^[\d+\-\s]{8,20}$")
    code: str = Field(min_length=4, max_length=8)

    @field_validator("mobile")
    @classmethod
    def norm(cls, v: str) -> str:
        return _normalize_mobile(v)


class OtpRequestResponse(BaseModel):
    sent: bool
    cooldown: int
    debug_code: str | None = None  # فقط در حالت تستی (console) پر می‌شود


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class RefreshRequest(BaseModel):
    refresh_token: str


class CurrentUser(BaseModel):
    id: str
    email: str
    full_name: str
    roles: list[str] = []
    permissions: list[str] = []
    tenant_id: str | None = None


# ---------- مدیریت کاربران ----------
ROLE_CHOICES = ("admin", "sales_manager", "sales_agent", "viewer")


class UserCreate(BaseModel):
    full_name: str = Field(min_length=2)
    mobile: str = Field(pattern=r"^[\d+\-\s]{8,20}$")
    role: str = Field(default="sales_agent")
    email: EmailStr | None = None
    password: str | None = Field(default=None, min_length=8)

    @field_validator("mobile")
    @classmethod
    def norm(cls, v: str) -> str:
        return _normalize_mobile(v)

    @field_validator("role")
    @classmethod
    def check_role(cls, v: str) -> str:
        if v not in ROLE_CHOICES:
            raise ValueError("نقش نامعتبر است")
        return v


class UserUpdate(BaseModel):
    full_name: str | None = None
    mobile: str | None = None
    role: str | None = None
    is_active: bool | None = None


class UserOut(BaseModel):
    id: str
    full_name: str
    mobile: str | None = None
    email: str
    is_active: bool
    roles: list[str] = []
