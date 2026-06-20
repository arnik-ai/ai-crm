"""محدودیت نرخ مبتنی بر Redis (fixed-window شمارنده‌ای ساده و کارآمد)."""
from fastapi import Request

from src.shared.config.settings import get_settings
from src.shared.errors.exceptions import AppError


class RateLimitError(AppError):
    status_code = 429
    code = "RATE_LIMITED"


def _parse_rule(rule: str) -> tuple[int, int]:
    """'100/minute' → (100, 60)."""
    count, _, unit = rule.partition("/")
    seconds = {"second": 1, "minute": 60, "hour": 3600}.get(unit.strip(), 60)
    return int(count), seconds


async def enforce_rate_limit(key: str, rule: str) -> None:
    from src.shared.db.redis_client import redis_client  # lazy: تست واحد بدون Redis

    limit, window = _parse_rule(rule)
    redis_key = f"ratelimit:{key}:{window}"
    current = await redis_client.incr(redis_key)
    if current == 1:
        await redis_client.expire(redis_key, window)
    if current > limit:
        raise RateLimitError("تعداد درخواست‌ها از حد مجاز گذشت")


def rate_limiter(rule: str | None = None):
    """Dependency محدودیت نرخ بر اساس IP کلاینت."""
    settings = get_settings()
    effective = rule or settings.rate_limit_default

    async def guard(request: Request) -> None:
        client_ip = request.client.host if request.client else "unknown"
        path = request.url.path
        await enforce_rate_limit(f"{client_ip}:{path}", effective)

    return guard


def login_rate_limiter():
    return rate_limiter(get_settings().rate_limit_login)
