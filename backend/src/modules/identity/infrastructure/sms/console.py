"""Provider پیامکِ تستی — کد را به‌جای ارسال واقعی، در لاگ می‌نویسد.

برای توسعه/تست بدون سامانه‌ی پیامکی. کد در پاسخ API هم برگردانده می‌شود
(چون returns_debug_code=True) تا بدون پیامک واقعی بتوان جریان ورود را تست کرد.
"""
import logging

from src.modules.identity.application.ports import SmsProvider

logger = logging.getLogger("sms.console")


class ConsoleSmsProvider(SmsProvider):
    async def send_otp(self, mobile: str, code: str) -> None:
        logger.info("OTP (console) → %s : %s", mobile, code)

    @property
    def returns_debug_code(self) -> bool:
        return True
