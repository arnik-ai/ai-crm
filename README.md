# CRM هوش‌مصنوعی‌محور برای مؤسسات آموزشی 🎓📞🤖

پلتفرم CRM **AI-Native** برای مؤسسات آموزشی ایران، با یکپارچه‌سازی **Workano Cloud PBX** و
هوش مصنوعی **AvalAI (GPT-5.5 / Whisper)**. سامانه به‌صورت خودکار تماس‌ها را ردیابی،
ضبط، رونویسی و تحلیل می‌کند؛ اطلاعات سرنخ را استخراج، امتیاز سرنخ و احتمال ثبت‌نام را
محاسبه و «بهترین اقدام بعدی» را پیشنهاد می‌دهد.

> سند پرامپت/مشخصات اصلی: [`docs/PROMPT-SPEC.md`](docs/PROMPT-SPEC.md)

---

## ✨ قابلیت‌های کلیدی
- ردیابی خودکار تماس ورودی/خروجی/ازدست‌رفته از طریق Webhook
- رونویسی صوت (Whisper) و تحلیل مکالمه (GPT-5.5) با **LangGraph**
- استخراج ساختاریافته‌ی اطلاعات سرنخ + امتیازدهی + پیشنهاد مرحله‌ی فروش
- داشبورد مدیر فروش (KPI، قیف فروش، عملکرد تیم)
- دستیار چت CRM («امروز با چه کسانی تماس بگیرم؟»، …)
- معماری تمیز (Clean Architecture) + قابل‌تعویض بودن Providerهای تلفنی و AI

## 🏗️ معماری (خلاصه)
```
Workano → Webhook → CRM Backend (FastAPI) → Celery → AvalAI (Whisper/GPT-5.5)
        → LangGraph → PostgreSQL → Dashboard (Next.js)
```
- لایه‌ی انتزاع `TelephonyProvider` → `WorkanoProvider` و `SimotelProvider` (آینده: Issabel/Asterisk)
- لایه‌ی انتزاع `LLMProvider`/`SpeechToTextProvider` → `AvalAI*Provider`

## 📚 مستندات (پوشه‌ی docs)
| سند | موضوع |
|---|---|
| [00-ARCHITECTURE](docs/00-ARCHITECTURE.md) | معماری سطح‌بالا، C4، لایه‌بندی، تصمیمات فنی |
| [01-DATABASE](docs/01-DATABASE.md) | اسکیمای PostgreSQL + ERD + DDL |
| [02-LANGGRAPH](docs/02-LANGGRAPH.md) | طراحی ایجنت‌ها، State، گراف، Retry |
| [03-API](docs/03-API.md) | طراحی کامل REST API |
| [04-WORKANO](docs/04-WORKANO.md) | یکپارچه‌سازی تلفنی (Workano) |
| [10-SIMOTEL](docs/10-SIMOTEL.md) | یکپارچه‌سازی تلفنی (سیموتل) ⭐ |
| [05-AVALAI](docs/05-AVALAI.md) | یکپارچه‌سازی AI |
| [06-SECURITY](docs/06-SECURITY.md) | معماری امنیت |
| [07-DEPLOYMENT](docs/07-DEPLOYMENT.md) | استقرار Parspack + CI/CD |
| [08-ROADMAP](docs/08-ROADMAP.md) | نقشه‌راه و مقیاس‌پذیری ۱۰۰٬۰۰۰+ |

## 🗂️ ساختار مخزن
```
crm/
├── backend/      # FastAPI (Clean Architecture) — راهنما: backend/README.md
├── frontend/     # Next.js 15 — راهنما: frontend/README.md
├── docs/         # ۹ سند معماری فارسی + Mermaid
└── .github/workflows/  # CI و Deploy (Parspack)
```

## 🚀 شروع سریع
```bash
# بک‌اند
cd backend && cp .env.example .env
pip install -e ".[dev]" && alembic upgrade head
uvicorn app.main:app --reload
celery -A app.worker.celery_app worker -l info -Q telephony,llm

# فرانت‌اند
cd frontend && cp .env.example .env.local
npm install && npm run dev
```

## 🧱 استک فناوری
**Backend:** Python 3.12 · FastAPI · SQLAlchemy 2.0 (async) · Alembic · Celery · Redis · PostgreSQL
**AI:** LangGraph · LangChain · AvalAI GPT-5.5 · AvalAI Whisper
**Frontend:** Next.js 15 · React 19 · TypeScript · TailwindCSS · TanStack Query
**Infra:** GitHub Actions · Parspack PaaS · S3-compatible Storage (بدون Docker)

## 📦 وضعیت
این مخزن شامل **معماری کامل + اسکلت کد آماده‌ی پیاده‌سازی** است (مطابق نقشه‌راه MVP در
[08-ROADMAP](docs/08-ROADMAP.md)). همه‌ی فایل‌های بک‌اند از نظر نحوی معتبر و ماژولار هستند.
