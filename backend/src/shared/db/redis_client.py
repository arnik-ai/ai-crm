"""کلاینت Redis مشترک (async)."""
import redis.asyncio as aioredis

from src.shared.config.settings import get_settings

_settings = get_settings()
redis_client = aioredis.from_url(_settings.redis_url, decode_responses=True)


async def get_redis():
    return redis_client
