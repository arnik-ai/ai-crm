"""تست‌های منطقِ خالصِ فاز ۲ باشگاه مشتریان — پاداش/مصرف/معرفی (بدونِ DB)."""
from src.modules.loyalty.application.rewards import (
    check_redeem,
    check_referral,
    gen_coupon,
)


def test_redeem_insufficient_points():
    ok, msg = check_redeem(balance=800, cost_points=1000,
                           account_level_order=1, min_level_order=None, stock=None)
    assert ok is False and "امتیاز" in msg


def test_redeem_ok():
    ok, msg = check_redeem(balance=1500, cost_points=1000,
                           account_level_order=2, min_level_order=None, stock=None)
    assert ok is True and msg == ""


def test_redeem_level_gate():
    # پاداشِ سطحِ ۳ (طلایی) برای کاربرِ سطحِ ۱ (برنزی) → رد
    ok, msg = check_redeem(balance=5000, cost_points=2000,
                           account_level_order=1, min_level_order=3, stock=None)
    assert ok is False and "سطح" in msg


def test_redeem_out_of_stock():
    ok, msg = check_redeem(balance=5000, cost_points=1000,
                           account_level_order=4, min_level_order=None, stock=0)
    assert ok is False and "موجودی" in msg


def test_referral_self_blocked():
    ok, msg = check_referral(referrer_student_id="s1", new_student_id="s1",
                             already_referred=False)
    assert ok is False and "خودت" in msg


def test_referral_duplicate_blocked():
    ok, msg = check_referral(referrer_student_id="s1", new_student_id="s2",
                             already_referred=True)
    assert ok is False and "قبلاً" in msg


def test_referral_valid():
    ok, msg = check_referral(referrer_student_id="s1", new_student_id="s2",
                             already_referred=False)
    assert ok is True and msg == ""


def test_coupon_format():
    c = gen_coupon("WELCOME")
    assert c.startswith("WELCOME-") and len(c) == len("WELCOME-") + 6
    # فقط بخشِ تصادفی (بعد از خط تیره) نباید کاراکترِ گیج‌کننده داشته باشد
    suffix = c.split("-", 1)[1]
    assert not (set(suffix) & set("0O1I"))
