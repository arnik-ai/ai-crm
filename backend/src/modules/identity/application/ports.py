"""Portهای ماژول هویت — اینترفیس‌های قابل‌تعویض (Provider Abstraction)."""
import logging
from abc import ABC, abstractmethod

_logger = logging.getLogger("sms")


class SmsProvider(ABC):
    """اینترفیس ارسال پیامک. پیاده‌سازی‌ها: Console (تست)، Melipayamak (واقعی)."""

    @abstractmethod
    async def send_otp(self, mobile: str, code: str) -> None:
        """کد یک‌بارمصرف را به شماره‌ی موبایل ارسال می‌کند.

        در صورت خطای ارسال باید استثنا پرتاب کند تا لایه‌ی بالا مدیریت کند.
        """

    async def send_text(self, mobile: str, text: str) -> None:
        """ارسال پیامکِ متنِ آزاد (غیر OTP).

        پیاده‌سازی پیش‌فرض فقط لاگ می‌کند تا با هر provid‌ری بدون خطا کار کند؛
        providerِ واقعی (مثل Melipayamak) این متد را با API ارسالِ خود بازنویسی
        می‌کند. این‌طور انتخاب سرویس‌دهنده بعداً بدون تغییر بقیه‌ی کد ممکن است.
        """
        _logger.info("SMS (text) → %s : %s", mobile, text)

    @property
    def returns_debug_code(self) -> bool:
        """آیا این provider حالت تست است و کد را برای نمایش برمی‌گرداند؟

        فقط برای Console درست است؛ providerهای واقعی هرگز کد را فاش نمی‌کنند.
        """
        return False
