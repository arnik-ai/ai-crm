"""Factory انتخاب SmsProvider بر اساس پیکربندی — Open/Closed."""
from src.modules.identity.application.ports import SmsProvider
from src.modules.identity.infrastructure.sms.console import ConsoleSmsProvider
from src.modules.identity.infrastructure.sms.melipayamak import MelipayamakSmsProvider
from src.shared.config.settings import get_settings


def get_sms_provider() -> SmsProvider:
    s = get_settings()
    if s.sms_provider == "melipayamak":
        return MelipayamakSmsProvider(
            username=s.melipayamak_username,
            password=s.melipayamak_password,
            sender=s.melipayamak_from,
            otp_pattern=s.melipayamak_otp_pattern,
        )
    # پیش‌فرض: حالت تستی (بدون ارسال واقعی)
    return ConsoleSmsProvider()
