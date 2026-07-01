"""هش و بررسی رمز عبور با bcrypt (مستقیم — سازگار با bcrypt نسخه‌ی جدید ۵.x).

قبلاً از passlib استفاده می‌شد که با bcrypt جدید ناسازگار بود و خطای «۷۲ بایت»
می‌داد. اینجا مستقیم از خودِ کتابخانه‌ی bcrypt استفاده می‌کنیم (پایدار و بدون
وابستگیِ نسخه‌ای). bcrypt حداکثر ۷۲ بایت رمز را می‌پذیرد؛ بلندتر کوتاه می‌شود.
"""
import bcrypt


def _to_bytes(plain: str) -> bytes:
    return plain.encode("utf-8")[:72]


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(_to_bytes(plain), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(_to_bytes(plain), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False
