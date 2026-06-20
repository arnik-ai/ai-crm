# بک‌اند CRM — FastAPI (Clean Architecture)

## ساختار پوشه‌ها
```
backend/
├── app/
│   ├── main.py            # نقطه‌ی ورود FastAPI (ثبت Routerها/Middleware)
│   └── worker.py          # پیکربندی Celery و taskها
├── src/
│   ├── shared/            # ابزار مشترک بین ماژول‌ها
│   │   ├── config/        # تنظیمات (Pydantic Settings)
│   │   ├── db/            # موتور SQLAlchemy، Session، Redis
│   │   ├── security/      # JWT، هش رمز
│   │   ├── storage/       # S3
│   │   └── errors/        # استثناهای دامنه‌ای
│   └── modules/           # هر ماژول = یک Bounded Context
│       ├── identity/      # کاربر/نقش/مجوز/Auth/RBAC
│       ├── crm/           # دانشجو/دوره/تگ/یادداشت/پیگیری/مراحل فروش
│       ├── telephony/     # تماس/ضبط/Webhook + TelephonyProvider
│       ├── ai_analysis/   # LangGraph + LLM/STT + امتیازدهی
│       ├── analytics/     # داشبورد
│       └── assistant/     # دستیار چت CRM
├── migrations/            # Alembic
├── sql/schema.sql         # اسکیمای مرجع
├── Procfile               # دستورات اجرا روی Parspack
├── runtime.txt            # python-3.12
└── requirements.txt
```

### لایه‌بندی هر ماژول (Clean Architecture)
- `domain/` — Entityها و مدل‌های دامنه (بدون وابستگی به فریم‌ورک).
- `application/` — Use Caseها، سرویس‌ها و **Portها** (اینترفیس‌ها).
- `infrastructure/` — پیاده‌سازی Portها (Repository، Provider، LangGraph).
- `api/` — Routerها و Schemaها (لایه‌ی Presentation).

## اجرای محلی
```bash
cp .env.example .env            # مقادیر را پر کنید
pip install -e ".[dev]"
alembic upgrade head            # یا: psql < sql/schema.sql
uvicorn app.main:app --reload   # API روی :8000
celery -A app.worker.celery_app worker -l info -Q telephony,llm
celery -A app.worker.celery_app beat -l info
```

## جریان end-to-end تماس
1. `POST /api/v1/webhooks/workano` → بررسی امضا → ثبت `webhook_log` (Idempotent) → enqueue.
2. Celery `process_telephony_event` → upsert `call` → تطبیق دانشجو → اگر `recording_ready` → enqueue تحلیل.
3. Celery `analyze_call` → دانلود فایل → S3 → LangGraph (Whisper→GPT-5.5) → ذخیره‌ی `transcript`/`lead_score`.
4. داشبورد/دستیار از طریق REST نتایج را نمایش می‌دهند.

## مستندات معماری
به پوشه‌ی [`../docs/`](../docs/) مراجعه کنید (۹ سند فارسی + Mermaid).
