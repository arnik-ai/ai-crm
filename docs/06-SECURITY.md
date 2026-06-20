# معماری امنیت

> نسخه ۱.۰ | Defense-in-Depth | منطبق بر نیازهای SaaS تجاری

## ۱. احراز هویت (Authentication)
- **JWT Access Token:** کوتاه‌عمر (۱۵ دقیقه)، شامل `sub`, `roles`, `tenant_id`, `exp`.
- **Refresh Token:** بلندعمر (۷ روز)، ذخیره‌شده در Redis با امکان ابطال؛ **Rotation** در هر refresh.
- **هش رمز عبور:** `bcrypt`/`argon2` با salt؛ هرگز ذخیره‌ی متن خام.
- **خروج امن:** ابطال refresh در Redis (blocklist).

## ۲. کنترل دسترسی (RBAC)
- نقش‌ها: `admin`, `sales_manager`, `sales_agent`, `viewer`.
- مجوزها به‌صورت `resource:action` (مثل `students:read`, `students:write`, `dashboard:read`).
- بررسی در لایه‌ی Presentation با Dependency (`require_permission("students:write")`).
- داده‌ها در سطح Tenant جداسازی می‌شوند (Row-Level scoping بر اساس `tenant_id`).

```python
def require_permission(perm: str):
    async def guard(user=Depends(current_user)):
        if perm not in user.permissions:
            raise HTTPException(403, {"code": "FORBIDDEN"})
        return user
    return guard
```

## ۳. امنیت Webhook
- تأیید امضای **HMAC-SHA256** (constant-time compare).
- **IP Allowlist** برای Workano.
- **Idempotency** و **Replay Protection** (پنجره‌ی زمانی).

## ۴. رمزنگاری
- **In Transit:** TLS اجباری (HTTPS) در تمام مسیرها.
- **At Rest:** رمزنگاری ستون‌های حساس (شماره موبایل/یادداشت‌ها) با `pgcrypto` یا envelope encryption؛ کلید در Secret Manager.
- **Storage:** فایل‌های ضبط در S3 با دسترسی خصوصی؛ پخش فقط با **Pre-signed URL** کوتاه‌عمر.

## ۵. محدودیت نرخ (Rate Limiting)
- بر پایه‌ی Redis (sliding window): پیش‌فرض ۱۰۰ req/min به‌ازای کاربر؛ Login سخت‌گیرانه‌تر (۵/min).
- محافظت Endpointهای AI (هزینه‌بر) با سهمیه‌ی جداگانه.

## ۶. اعتبارسنجی ورودی
- Pydantic v2 برای همه‌ی ورودی‌ها؛ نرمال‌سازی موبایل، طول/فرمت فیلدها.
- جلوگیری از SQL Injection با ORM پارامتری؛ خروجی HTML در فرانت escape می‌شود.

## ۷. حسابرسی و لاگ (Audit)
- ثبت هر عملیات حساس در `audit_logs` (actor, action, entity, diff, ip).
- لاگ‌های ساختاریافته (JSON) به stdout؛ بدون لاگ‌کردن داده‌ی حساس/توکن.

## ۸. مدیریت رازها (Secrets)
- در GitHub: **GitHub Secrets** (Actions).
- در Parspack: متغیرهای محیطی رمز (Secret env)؛ هرگز در مخزن کد نباشند.
- فایل `.env.example` فقط نام متغیرها (بدون مقدار).

## ۹. چک‌لیست امنیتی استقرار
- [ ] HTTPS و HSTS فعال
- [ ] CORS محدود به دامنه‌ی فرانت
- [ ] Security headers (CSP, X-Frame-Options)
- [ ] چرخش کلیدها و توکن‌ها
- [ ] پشتیبان‌گیری رمزنگاری‌شده‌ی DB
- [ ] اسکن وابستگی‌ها در CI (Dependabot / pip-audit)
