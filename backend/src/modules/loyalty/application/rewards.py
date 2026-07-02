"""منطقِ خالصِ پاداش/معرفی — بدونِ DB، تست‌پذیر و قطعی.

جدا از سرویسِ DB نگه داشته شده تا صحتِ قوانین (کفایتِ امتیاز، سطح، موجودی، ضدِخودمعرفی)
به‌راحتی واحد-تست شود.
"""
import secrets

_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # بدونِ کاراکترهای گیج‌کننده (O/0/I/1)


def gen_coupon(prefix: str = "LOY") -> str:
    """کدِ کوپنِ کوتاهِ خوانا؛ مثلِ LOY-7K3M9Q."""
    return f"{prefix}-" + "".join(secrets.choice(_ALPHABET) for _ in range(6))


def check_redeem(*, balance: int, cost_points: int,
                 account_level_order: int, min_level_order: int | None,
                 stock: int | None) -> tuple[bool, str]:
    """آیا این پاداش قابلِ‌دریافت است؟ (ok, پیامِ خطای فارسی)."""
    if cost_points <= 0:
        return False, "پاداشِ نامعتبر است."
    if balance < cost_points:
        return False, "امتیازِ کافی نداری."
    if min_level_order is not None and account_level_order < min_level_order:
        return False, "سطحِ تو برای این پاداش کافی نیست."
    if stock is not None and stock <= 0:
        return False, "موجودیِ این پاداش تمام شده."
    return True, ""


def check_referral(*, referrer_student_id, new_student_id, already_referred: bool
                   ) -> tuple[bool, str]:
    """اعتبارِ معرفی: نه خودمعرفی، نه معرفیِ تکراری."""
    if referrer_student_id is not None and referrer_student_id == new_student_id:
        return False, "نمی‌توانی خودت را معرفی کنی."
    if already_referred:
        return False, "این دانش‌آموز قبلاً معرفی شده است."
    return True, ""
