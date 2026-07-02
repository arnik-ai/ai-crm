"""تست‌های موتورِ قوانینِ باشگاه مشتریان — قطعی‌بودنِ محاسبه و ارزیابیِ شرط‌ها.

این‌ها pure و بدونِ DB هستند (منطقِ هسته‌ی امتیازدهی). صحتِ عددها = تضمینِ «همیشه
همان امتیاز» که فلسفه‌ی این ماژول است.
"""
from src.modules.loyalty.application.rule_engine import (
    compute_points,
    conditions_match,
    evaluate_rule,
)


def test_fixed_points():
    assert compute_points({"type": "fixed", "points": 10}, {}) == 10
    assert compute_points({"type": "fixed", "points": -5}, {}) == -5


def test_ratio_with_cap():
    # ۱ امتیاز به‌ازای هر ۱۰۰٬۰۰۰ تومان، سقفِ ۱۰۰۰
    c = {"type": "ratio", "per": 100000, "points": 10, "max": 1000}
    assert compute_points(c, {"amount": 1_850_000}) == 180   # floor(18.5)*10
    assert compute_points(c, {"amount": 50_000}) == 0        # کمتر از یک پله
    assert compute_points(c, {"amount": 100_000_000}) == 1000  # به سقف می‌خورد


def test_tiered():
    c = {"type": "tiered", "field": "amount",
         "tiers": [{"min": 0, "points": 100}, {"min": 5_000_000, "points": 500}]}
    assert compute_points(c, {"amount": 1_000_000}) == 100
    assert compute_points(c, {"amount": 6_000_000}) == 500


def test_conditions_and_operators():
    assert conditions_match([{"field": "status", "op": "==", "value": "answered"}],
                            {"status": "answered"}) is True
    assert conditions_match([{"field": "outcome", "op": "in",
                              "value": ["successful", "purchased"]}],
                            {"outcome": "purchased"}) is True
    assert conditions_match([{"field": "purchase_index", "op": ">=", "value": 2}],
                            {"purchase_index": 1}) is False
    # نبودِ فیلد در مقایسه‌ی عددی → false (نه خطا)
    assert conditions_match([{"field": "x", "op": ">", "value": 1}], {}) is False


def test_evaluate_rule_gate():
    # شرط نمی‌گیرد → None (نه صفر)
    rule = {"when": [{"field": "status", "op": "==", "value": "missed"}],
            "compute": {"type": "fixed", "points": -5}}
    assert evaluate_rule(rule, {"status": "answered"}) is None
    assert evaluate_rule(rule, {"status": "missed"}) == -5


def test_purchase_bonus_rule():
    rule = {"when": [{"field": "purchase_index", "op": ">=", "value": 2}],
            "compute": {"type": "fixed", "points": 200}}
    assert evaluate_rule(rule, {"purchase_index": 1}) is None
    assert evaluate_rule(rule, {"purchase_index": 2}) == 200
    assert evaluate_rule(rule, {"purchase_index": 5}) == 200
