"""پایه‌ی SQLAlchemy (async) — موتور، Session و Base مشترک."""
from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, func
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from src.shared.config.settings import get_settings

settings = get_settings()

# statement_timeout: هر کوئری که بیش از این مدت (میلی‌ثانیه) طول بکشد، توسط
# PostgreSQL خودکار قطع می‌شود تا یک کوئریِ گیرکرده، اتصال و سرور را هنگ نکند.
# ۳۰ ثانیه برای کوئری‌های عادی بسیار سخاوتمندانه است؛ خروجی‌های حجیم چون
# دسته‌دسته (streaming) خوانده می‌شوند، هر فِچ کوتاه است و به این سقف نمی‌خورد.
_STATEMENT_TIMEOUT_MS = "30000"

_connect_args: dict = {}
if settings.database_url.startswith("postgresql"):
    _connect_args = {"server_settings": {"statement_timeout": _STATEMENT_TIMEOUT_MS}}

engine = create_async_engine(
    settings.database_url,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
    echo=settings.app_env == "development",
    connect_args=_connect_args,
)

SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


class Base(DeclarativeBase):
    """Base مشترک با ستون‌های id/created_at/updated_at."""

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


async def get_session() -> AsyncSession:
    """Dependency برای تزریق Session در FastAPI."""
    async with SessionLocal() as session:
        yield session
