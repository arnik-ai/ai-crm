"""سرویس کد یک‌بارمصرف (OTP) — تولید، ذخیره‌ی امن، و بررسی.

اصول امنیتی (آماده‌ی پروداکشن):
- کد به‌صورت hash‌شده (HMAC-SHA256 با secret_key) در Redis ذخیره می‌شود، نه خام.
- عمر کوتاه (TTL) برای کد.
- محدودیت فاصله بین درخواست‌ها (cooldown) برای جلوگیری از اسپم پیامک.
- محدودیت تعداد تلاشِ اشتباه (برای جلوگیری از حدس‌زدن کد).
- مقایسه‌ی زمان‌ثابت (hmac.compare_digest) برای جلوگیری از حمله‌ی زمان‌سنجی.
"""
import hashlib
import hmac
import secrets

from src.shared.config.settings import get_settings
from src.shared.errors.exceptions import ValidationError
from src.shared.security.rate_limit import RateLimitError


def _hash_code(code: str) -> str:
    s = get_settings()
    return hmac.new(s.secret_key.encode(), code.encode(), hashlib.sha256).hexdigest()


class OtpService:
    def __init__(self, redis):
        self._redis = redis
        self._s = get_settings()

    def _code_key(self, mobile: str) -> str:
        return f"otp:code:{mobile}"

    def _attempts_key(self, mobile: str) -> str:
        return f"otp:attempts:{mobile}"

    def _cooldown_key(self, mobile: str) -> str:
        return f"otp:cooldown:{mobile}"

    async def generate(self, mobile: str) -> str:
        """کد جدید تولید، hash آن را ذخیره و خود کد را برمی‌گرداند (برای ارسال).

        اگر هنوز در بازه‌ی cooldown باشد، RateLimitError پرتاب می‌کند.
        """
        # جلوگیری از درخواست مکرر
        if await self._redis.get(self._cooldown_key(mobile)):
            raise RateLimitError("کمی صبر کنید و دوباره درخواست کد بزنید")

        # کد عددیِ تصادفیِ امن
        digits = self._s.otp_length
        code = "".join(secrets.choice("0123456789") for _ in range(digits))

        await self._redis.set(
            self._code_key(mobile), _hash_code(code), ex=self._s.otp_ttl
        )
        await self._redis.delete(self._attempts_key(mobile))
        await self._redis.set(
            self._cooldown_key(mobile), "1", ex=self._s.otp_request_cooldown
        )
        return code

    async def verify(self, mobile: str, code: str) -> bool:
        """کد را بررسی می‌کند. در صورت درستی، کد را باطل و True برمی‌گرداند."""
        stored = await self._redis.get(self._code_key(mobile))
        if stored is None:
            raise ValidationError("کد منقضی شده یا وجود ندارد؛ دوباره درخواست کنید")

        # شمارش تلاش‌ها و قطع پس از حد مجاز
        attempts = await self._redis.incr(self._attempts_key(mobile))
        if attempts == 1:
            await self._redis.expire(self._attempts_key(mobile), self._s.otp_ttl)
        if attempts > self._s.otp_max_attempts:
            await self._redis.delete(self._code_key(mobile))
            raise RateLimitError("تعداد تلاش‌ها زیاد شد؛ کد جدید درخواست کنید")

        # مقایسه‌ی زمان‌ثابت
        if not hmac.compare_digest(stored, _hash_code(code)):
            return False

        # موفق: باطل‌کردن کد و شمارنده‌ها
        await self._redis.delete(self._code_key(mobile))
        await self._redis.delete(self._attempts_key(mobile))
        return True
