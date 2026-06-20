# راهنمای گام‌به‌گام استقرار روی پارس‌پک (ساده)

> این راهنما فرض می‌کند تازه‌کار هستی. مرحله‌به‌مرحله جلو برو.

---

## پیش‌نیازها
- یک حساب در [پارس‌پک](https://www.parspack.com)
- کد پروژه روی **GitHub** (مرحله ۱ پایین)

---

## مرحله ۱ — کد را روی GitHub بگذار
۱. در GitHub یک Repository خالی بساز (مثلاً `ai-crm`).
۲. در پوشه‌ی پروژه این دستورها را بزن (در ترمینال):
```bash
git remote add origin https://github.com/USERNAME/ai-crm.git
git branch -M main
git push -u origin main
```

---

## مرحله ۲ — در پارس‌پک سرویس دیتابیس و Redis بساز
از پنل پارس‌پک:
۱. یک **PostgreSQL** بساز → بعد از ساخت، یک «رشته اتصال» (Connection String) می‌دهد. آن را کپی کن.
   - شکلش این‌طوری است: `postgres://user:pass@host:5432/dbname`
   - ⚠️ در `.env` باید `postgresql+asyncpg://...` باشد. یعنی فقط `postgres` را به `postgresql+asyncpg` تبدیل کن.
۲. یک **Redis** بساز → آدرسش را کپی کن (شکل: `redis://host:6379`).

---

## مرحله ۳ — اپ بک‌اند را بساز (پوشه‌ی backend)
از پنل پارس‌پک یک اپ **Python** بساز و به Repository گیت‌هابت وصلش کن:
- **پوشه‌ی ریشه (Root/Subdirectory):** `backend`
- پارس‌پک خودش `requirements.txt`، `runtime.txt` و `Procfile` را می‌خواند.

### متغیرهای محیطی (Environment) این اپ را پر کن:
| نام | مقدار |
|---|---|
| `APP_ENV` | `production` |
| `SECRET_KEY` | (همان مقدار داخل `.env` یا یک رشته‌ی تصادفی جدید) |
| `DATABASE_URL` | رشته‌ی Postgres از مرحله ۲ (با `postgresql+asyncpg://`) |
| `REDIS_URL` | آدرس Redis از مرحله ۲ + `/0` |
| `CELERY_BROKER_URL` | آدرس Redis + `/1` |
| `CELERY_RESULT_BACKEND` | آدرس Redis + `/2` |
| `CORS_ORIGINS` | آدرس اپ فرانت (بعد از مرحله ۵ پر کن) |
| `AVALAI_API_KEY` | کلید AvalAI خودت |
| `WORKANO_WEBHOOK_SECRET` | یک رمز دلخواه قوی |
| `SEED_ADMIN_EMAIL` | `admin@crm.local` (یا ایمیل خودت) |
| `SEED_ADMIN_PASSWORD` | یک رمز قوی |

> بقیه‌ی متغیرها را از روی فایل `backend/.env.example` کپی کن.

### نکته‌ی مهم درباره‌ی worker و beat
بک‌اند سه «فرایند» دارد (در `Procfile`): `web`, `worker`, `beat`.
- اگر پارس‌پک اجازه‌ی چند Process بدهد → هر سه را روشن کن.
- اگر فقط `web` ممکن بود → فعلاً همان `web` کافی است؛ تماس‌ها ثبت می‌شوند ولی تحلیل صوتی (worker) بعداً فعال می‌شود.

---

## مرحله ۴ — جدول‌ها و کاربر ادمین خودکار ساخته می‌شوند
موقع استقرار، فاز `release` در `Procfile` این کارها را **خودکار** انجام می‌دهد:
```
alembic upgrade head   →  ساخت همه‌ی جدول‌ها
python -m app.seed     →  ساخت نقش‌ها، مجوزها، کاربر ادمین و مراحل فروش
```
پس کار دستی لازم نیست. ✅

---

## مرحله ۵ — اپ فرانت‌اند را بساز (پوشه‌ی frontend)
یک اپ **Node.js** در پارس‌پک بساز:
- **پوشه‌ی ریشه:** `frontend`
- **Build command:** `npm run build`
- **Start command:** `npm run start`
- **متغیر محیطی:** `NEXT_PUBLIC_API_BASE` = آدرس اپ بک‌اند (مثلاً `https://api-crm.pارسپک...`)

بعد از ساخت، آدرس فرانت را در متغیر `CORS_ORIGINS` بک‌اند (مرحله ۳) بگذار و بک‌اند را دوباره Deploy کن.

---

## مرحله ۶ — تست
۱. آدرس بک‌اند + `/healthz` را باز کن → باید `{"status":"ok"}` ببینی.
۲. آدرس فرانت را باز کن → صفحه‌ی ورود.
۳. با `admin@crm.local` و رمزی که گذاشتی وارد شو.

---

## مرحله ۷ — اتصال تلفن Workano (وقتی آماده شدی)
در پنل Workano، آدرس Webhook را روی این بگذار:
```
https://آدرس-بک‌اند/api/v1/webhooks/workano
```
و همان `WORKANO_WEBHOOK_SECRET` را در Workano هم تنظیم کن تا امضاها بخوانند.

---

## مشکلات رایج
| مشکل | راه‌حل |
|---|---|
| خطای اتصال دیتابیس | مطمئن شو `DATABASE_URL` با `postgresql+asyncpg://` شروع می‌شود |
| صفحه‌ی فرانت داده ندارد | `NEXT_PUBLIC_API_BASE` و `CORS_ORIGINS` درست تنظیم شده‌اند؟ |
| ورود کار نمی‌کند | فاز seed اجرا شده؟ لاگ استقرار را ببین |
| تحلیل صوتی انجام نمی‌شود | اپ `worker` روشن است؟ `AVALAI_API_KEY` پر است؟ |
