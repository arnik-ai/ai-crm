"""موتورِ قوانینِ امتیازدهیِ باشگاه مشتریان — قطعی، خالص و تست‌پذیر (بدونِ DB).

چرا این‌طور: امتیاز باید همیشه قطعی و قابلِ‌حسابرسی باشد (خرید = دقیقاً همان امتیاز)،
پس هیچ LLM/تصادفی‌ای در این لایه نیست. قوانین دیتا هستند (JSON) و اینجا فقط ارزیابی
و محاسبه می‌شوند. توابع pure‌اند تا واحد-تست ساده باشد.

قالبِ definition یک rule:
  {
    "when": [ {"field": "...", "op": "...", "value": ...}, ... ],   # AND؛ اختیاری
    "compute": {"type": "fixed"|"ratio"|"tiered", ...}
  }

عملگرهای مجاز: == != > >= < <= in not_in
انواع compute:
  fixed  → {"type":"fixed","points": N}
  ratio  → {"type":"ratio","per": X,"points": P,"max": M?}  → floor(value/per)*P (سقفِ M)
  tiered → {"type":"tiered","field":"amount","tiers":[{"min":A,"points":P}, ...]}
"""
from math import floor
from typing import Any


def _cmp(actual: Any, op: str, expected: Any) -> bool:
    """ارزیابیِ یک شرطِ تکی. مقدارِ گم‌شده (None) برای عملگرهای مقایسه‌ای false است."""
    if op == "==":
        return actual == expected
    if op == "!=":
        return actual != expected
    if op == "in":
        return actual in (expected or [])
    if op == "not_in":
        return actual not in (expected or [])
    # عملگرهای عددی — اگر مقدار نبود یا عددی نبود، false
    if actual is None:
        return False
    try:
        a, e = float(actual), float(expected)
    except (TypeError, ValueError):
        return False
    if op == ">":
        return a > e
    if op == ">=":
        return a >= e
    if op == "<":
        return a < e
    if op == "<=":
        return a <= e
    return False


def conditions_match(when: list[dict] | None, payload: dict) -> bool:
    """آیا همه‌ی شرط‌ها (AND) برقرارند؟ نبودِ when یعنی همیشه true."""
    for cond in when or []:
        if not _cmp(payload.get(cond.get("field")), cond.get("op", "=="), cond.get("value")):
            return False
    return True


def compute_points(compute: dict, payload: dict) -> int:
    """امتیازِ محاسبه‌شده بر اساسِ نوعِ compute. خروجی همیشه int (قطعی)."""
    ctype = compute.get("type")
    if ctype == "fixed":
        return int(compute.get("points", 0))
    if ctype == "ratio":
        field = compute.get("field", "amount")
        value = payload.get(field) or 0
        per = compute.get("per", 1) or 1
        pts = floor(float(value) / float(per)) * int(compute.get("points", 0))
        cap = compute.get("max")
        return min(pts, int(cap)) if cap is not None else pts
    if ctype == "tiered":
        field = compute.get("field", "amount")
        value = float(payload.get(field) or 0)
        best = 0
        for tier in sorted(compute.get("tiers", []), key=lambda t: t.get("min", 0)):
            if value >= float(tier.get("min", 0)):
                best = int(tier.get("points", 0))
        return best
    return 0


def evaluate_rule(definition: dict, payload: dict) -> int | None:
    """اگر ruleٍ می‌گیرد → امتیاز (ممکن است منفی/صفر)؛ اگر شرط‌ها نگرفت → None.

    نکته: امتیازِ صفر معتبر است (فرق دارد با «نگرفتن» = None) تا در لاگ دیده شود.
    """
    if not conditions_match(definition.get("when"), payload):
        return None
    return compute_points(definition.get("compute", {}), payload)
