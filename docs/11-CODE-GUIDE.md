# راهنمای مرور کد (Code Guide) — فایل‌به‌فایل

> سند مرجعِ «این فایل چه‌کار می‌کند؟» برای کل پروژه. هدف: هر کس (یا خودِ آینده‌ی ما)
> با خواندن این سند بفهمد هر فایل چه نقشی دارد، توابع کلیدی‌اش چیست و نکته‌ی مهمش کجاست.
>
> نسخه ۱.۰ | به‌روزرسانی: ۱۴۰۵/۰۴/۰۷ (2026-06-28) | مکملِ [`00-ARCHITECTURE.md`](00-ARCHITECTURE.md)

معماری کلی: **Clean / Hexagonal** در هر ماژول →
`api/` (ورودی HTTP) → `application/` (سرویس‌ها + ports) → `domain/` (مدل خالص) → `infrastructure/` (DB، Provider، LangGraph).
قانون: دامنه به فریم‌ورک وابسته نیست؛ Providerها پشت اینترفیس.

---

## فهرست
- [بک‌اند — نقطه‌ی ورود و زیرساخت](#بکاند--نقطهی-ورود)
- [بک‌اند — لایه‌ی مشترک (shared)](#بکاند--لایهی-مشترک-shared)
- [ماژول identity (هویت)](#ماژول-identity-هویت)
- [ماژول crm](#ماژول-crm)
- [ماژول telephony (تلفنی)](#ماژول-telephony-تلفنی)
- [ماژول ai_analysis (تحلیل هوش مصنوعی)](#ماژول-ai_analysis-تحلیل-هوش-مصنوعی)
- [ماژول analytics (داشبورد/گزارش)](#ماژول-analytics-داشبوردگزارش)
- [ماژول assistant (دستیار)](#ماژول-assistant-دستیار)
- [فرانت‌اند](#فرانتاند)

---

## بک‌اند — نقطه‌ی ورود

### `backend/app/main.py`
نقطه‌ی ورود FastAPI: ثبت routerها زیر `/api/v1`، middlewareها (CORS، GZip ≥۱KB، rate-limit بر اساس IP+مسیر با تخفیف ملایم اگر Redis نبود)، تبدیل `AppError` به JSON ساختاریافته، و health checkها: `/healthz` (زنده‌بودن) و `/readyz` (آمادگی DB+Redis، در صورت خرابی 503).

### `backend/app/worker.py`
پیکربندی Celery + دو تسک async. `_run(coro)` کوروتین را داخل تسک سنکرون اجرا می‌کند. `process_telephony_event` رویداد وب‌هوک را پردازش و در صورت آماده‌بودن ضبط، تحلیل را صف می‌کند. `analyze_call_task` ضبط را دانلود و پایپ‌لاین LangGraph را اجرا می‌کند. دو صف (`telephony`/`llm`)، `acks_late`، ۳ بار retry.

### `backend/app/seed.py`
داده‌ی اولیه (idempotent): ۱۱ مجوز، ۴ نقش (admin/sales_manager/sales_agent/viewer)، کاربر ادمین (از env)، و ۷ مرحله‌ی فروش با رنگ. با چک وجود، از تکرار جلوگیری می‌کند.

---

## بک‌اند — Migrations و Schema

### `backend/migrations/env.py`
محیط async الِمبیک: همه‌ی مدل‌ها را import می‌کند تا `Base.metadata` کامل باشد، سپس migration را روی اتصال async اجرا می‌کند.

### `backend/migrations/versions/*.py`
- **0001_initial_schema** — کل `sql/schema.sql` را اجرا می‌کند (منبع واحدِ حقیقت). downgrade با CASCADE.
- **0002_student_call_fields** — افزودن city/field/grade/goal به students و outcome به calls (idempotent، `IF NOT EXISTS`).
- **0003_user_mobile** — افزودن ستون موبایل به users + ایندکس یکتای جزئی (`WHERE mobile IS NOT NULL`) برای ورود OTP.
- **0004_sales_table** — جدول `sales` (محصول، مدت برنامه، جزئیات واریز، موعد تمدید) + ۴ ایندکس.
- **0005_gpa_and_messages** — ستون `gpa` به students + جدول `messages` (لاگ پیامک/واتساپ/تلگرام).

### `backend/sql/schema.sql`
اسکیمای مرجع PostgreSQL. گروه‌ها: **هویت/تنانت** (tenants, users, roles, permissions, پیوندها) · **CRM** (courses, sales_stages, students, tags, student_tags, notes, followups, activities, sales, messages) · **تلفنی** (calls, recordings, transcripts) · **AI** (lead_scores) · **حسابرسی/وب‌هوک** (webhook_logs, audit_logs). ایندکس‌های جزئی (soft-delete، followup pending، renewal) + GIN روی JSONB.

---

## بک‌اند — لایه‌ی مشترک (shared)

### `backend/src/shared/config/settings.py`
پیکربندی ۱۲-Factor از env. گروه‌ها: App، Database، Redis/Celery، JWT (access=900s، refresh=7روز)، S3، Telephony (workano|simotel)، AI (avalai: gpt-5.5 + whisper-1)، Security (rate limit)، OTP/SMS (طول ۵، TTL=۱۲۰s، cooldown=۶۰s، حداکثر ۵ تلاش). `get_settings()` با `lru_cache` تک‌نمونه است.

### `backend/src/shared/db/base.py`
موتور و session async. `engine` با `statement_timeout=30s`، pool_size=10، pre-ping. `Base` با ستون‌های خودکار id/created_at/updated_at. `get_session()` به‌عنوان Dependency. `expire_on_commit=False`.

### `backend/src/shared/db/redis_client.py`
کلاینت Redis async تک‌نمونه با `decode_responses=True`.

### `backend/src/shared/db/audit_model.py`
مدل ORM لاگ حسابرسی: actor_id، action، entity، entity_id، diff (JSONB)، ip (INET)، created_at. بدون FK روی entity_id (عمومی).

### `backend/src/shared/security/jwt.py`
ساخت/اعتبارسنجی JWT. `create_access_token` (payload شامل sub، نقش‌ها، مجوزها، jti). `create_refresh_token` (برمی‌گرداند token+jti برای blacklist). `decode_token` (در صورت نامعتبر، AuthError). jti امکان باطل‌سازی هر توکن را می‌دهد.

### `backend/src/shared/security/password.py`
هش/تأیید رمز با bcrypt (passlib). `hash_password` / `verify_password`. `deprecated="auto"` برای مهاجرت آینده.

### `backend/src/shared/security/rate_limit.py`
محدودکننده‌ی نرخِ پنجره‌ثابت روی Redis. `enforce_rate_limit` با شمارنده + expire. اگر Redis نبود، middleware استثنا را می‌بلعد (تخفیف ملایم). `login_rate_limiter` پیش‌تنظیمِ ۵/دقیقه.

### `backend/src/shared/security/audit.py`
`record_audit()` یک ردیف AuditLog به session اضافه می‌کند (commit با فراخواننده).

### `backend/src/shared/storage/s3.py`
ذخیره‌سازی S3-سازگار برای ضبط‌ها. `put()` آپلود و برگرداندن key؛ `presigned_url()` لینک امضاشده برای پخش. boto3 سنکرون داخل `asyncio.to_thread`.

### `backend/src/shared/cache/json_cache.py`
کش JSON با تخفیف ملایم. `cached_json()` get/set؛ هر خطای Redis بی‌صدا → اجرای producer. مناسب تجمیع‌های داشبورد.

### `backend/src/shared/errors/exceptions.py`
سلسله‌مراتب خطا با status code و کد: AppError(400)، AuthError(401)، ForbiddenError(403)، NotFoundError(404)، ConflictError(409)، ValidationError(422). در middleware به JSON تبدیل می‌شوند.

### `backend/src/shared/export/csv_stream.py`
خروجی CSV استریم‌شده برای داده‌ی بزرگ بدون بافر کامل. `stream_csv_response()` با BOM (UTF-8) برای اکسل فارسی؛ ارقام فارسی→لاتین؛ تولید دسته‌ای (۱۰۰۰‌تایی).

### `backend/src/shared/utils/jalali.py`
تبدیل میلادی↔شمسی (بدون کتابخانه‌ی بیرونی) + `fiscal_month()`: ماه مالی از یازدهم هر ماه شمسی شروع می‌شود (روز < ۱۱ → ماه قبل).

---

## ماژول identity (هویت)

### `api/routes.py`
endpointهای احراز هویت: login (با rate-limit)، otp/request، otp/verify، refresh، logout، me. توکن access/refresh برمی‌گرداند.

### `api/users_routes.py`
مدیریت اعضای تیم (لیست/ساخت/ویرایش/فعال/غیرفعال) — همه پشت مجوز `users:read|write` + لاگ حسابرسی.

### `api/dependencies.py`
گاردها: `current_user()` توکن Bearer را به مدل کاربر تبدیل می‌کند؛ `require_permission(perm)` وجود مجوز را بررسی می‌کند (admin همه را دارد).

### `api/schemas.py`
schemaهای ورود/OTP/توکن/کاربر. نرمال‌سازی موبایل (`0`→`+98`)، رمز حداقل ۸ کاراکتر. `ROLE_CHOICES`.

### `application/auth_service.py`
منطق ورود (ایمیل+رمز یا OTP). ساخت توکن‌ها، ذخیره‌ی jtiِ refresh در Redis (۷روز)، چرخش توکن (refresh قبلی حذف). برای جلوگیری از افشای وجود کاربر، OTP همیشه موفق پاسخ می‌دهد.

### `application/otp_service.py`
تولید/تأیید OTP. کد، هش HMAC-SHA256 در Redis (نه plaintext)، cooldown، سقف تلاش، مقایسه‌ی time-constant (`hmac.compare_digest`).

### `application/user_service.py`
CRUD کاربر. برای کاربرِ فقط-OTP، ایمیل ساختگی `{digits}@otp.local` + رمز تصادفی غیرقابل‌استفاده. اعتبارسنجی نقش + حسابرسی.

### `application/ports.py`
اینترفیس `SmsProvider`: `send_otp()` (اجباری)، `send_text()` (پیش‌فرض فقط لاگ — provider واقعی override می‌کند)، `returns_debug_code`.

### `infrastructure/models.py`
ORM: User (email یکتا، mobile یکتای nullable)، Role، Permission + پیوندهای many-to-many با `selectin`.

### `infrastructure/sms/console.py`
Provider تستی: کد را لاگ می‌کند و در پاسخ API برمی‌گرداند (`returns_debug_code=True`).

### `infrastructure/sms/melipayamak.py`
Provider واقعی ملی‌پیامک. `send_otp` (الگو یا متن ساده)، `send_text` (ارسال واقعیِ متن آزاد از طریق SendSMS). `_send_plain` مشترک بین هر دو.

### `infrastructure/sms/factory.py`
انتخاب provider بر اساس تنظیمات (`melipayamak` یا پیش‌فرض Console) — Open/Closed.

---

## ماژول crm

### `api/routes.py`
همه‌ی عملیات CRM: دانشجو (CRUD/خروجی)، followups، sales (لیست/timeline/repeat-customers/خروجی)، messages، courses، tags، sales-stages — هر endpoint پشت مجوز.

### `api/schemas.py`
schemaها + enumها: `StudyField` (تجربی/ریاضی/انسانی/سایر)، `Grade` (دهم..سایر)، `LeadSource` (سایت/اینستاگرام/تلگرام/روبیکا/بله/پیامک/سایر)، `MessageChannel`. `SaleCreate` محصول را با `PRODUCTS` می‌سنجد؛ «برنامه» الزاماً `program_months` دارد. نرمال‌سازی موبایل.

### `application/student_service.py`
منطق دانشجو: `list` (با subquery تعداد تماس)، `create` (چک تکراری موبایل؛ همه‌ی فیلدها را ذخیره می‌کند)، `update`، `soft_delete`، `change_stage` (+activity)، `add_note`، followups، `list_incomplete` (فیلدهای گمشده)، `find_or_create_by_mobile`. کوئری‌های خروجی.

### `application/sales_service.py`
فروش. `create_sale` (ساخت خودکار دانشجو، محاسبه‌ی renewal برای «برنامه»، followup خودکار +۵ روز). `list_sales` (جمع تفکیکی برنامه/سایر). `purchase_timeline` (ورود→اولین تماس→خرید). `repeat_customers` (گروه‌بندی بر اساس موبایل، فاصله‌ی روز بین خریدها).

### `application/messaging_service.py`
ساخت پیام: برای SMS واقعاً `send_text` صدا زده می‌شود (خطا → status=failed)؛ واتساپ/تلگرام فقط لاگ می‌شوند. `list` با join به Student. `export_query` برای CSV.

### `application/catalog_service.py`
کاتالوگ: Courses (لیست/ساخت/ویرایش با slug)، Tags (لیست/ساخت/اتصال idempotent)، SalesStages (لیست/ساخت).

### `infrastructure/models.py`
ORM: Student (موبایل ایندکس، soft-delete با deleted_at، gpa)، Course (slug یکتا)، SalesStage (order_index، is_terminal)، Tag، Note، Followup (due_at ایندکس)، Activity (JSONB)، Sale (snapshot نام/موبایل، renewal_due_at ایندکس)، Message (channel/status).

---

## ماژول telephony (تلفنی)

### `api/routes.py`
لیست/جزئیات/خروجی تماس (صفحه‌بندی، فیلتر جهت/وضعیت). `POST /outcome` نتیجه را ثبت و در صورت تاریخ تماس بعدی، followup می‌سازد. `GET /recording` لینک امضاشده‌ی S3.

### `api/webhook.py`
دریافت وب‌هوک Workano/Simotel (هندلر مشترک `_receive`): تأیید امضا، parse، `handle_webhook()`. پاسخ فوری 200؛ پردازش async صف می‌شود.

### `application/call_query_service.py`
کوئری تماس‌ها با آخرین امتیاز سرنخ. `list` (صفحه‌بندی + نام دانشجو)، `set_outcome` (به‌روزرسانی نتیجه + ساخت followup/دانشجو در صورت نیاز)، `export_calls_query`، `detail` (recording/transcript/score).

### `application/webhook_service.py`
ورودی وب‌هوک: parse رویداد، upsert webhook_log با idempotency (provider+event_type+external_id)، در صورت تکرار «duplicate»، صف کردن پردازش.

### `application/process_event.py`
تسک async: خواندن webhook_log، تطبیق/ساخت دانشجو با شماره‌ی تماس‌گیرنده، upsert تماس، ثبت activity، صف تحلیل اگر recording_ready. **شماره موبایل از provider می‌آید، نه AI.**

### `application/ports.py`
اینترفیس `TelephonyProvider`: `verify_signature()`، `parse_event()`→TelephonyEvent، `fetch_recording()`.

### `domain/events.py`
مدل خنثی `TelephonyEvent`: event_type (incoming/outgoing/missed/finished/recording_ready)، direction، شماره‌ها، زمان‌ها، recording_url، payload خام.

### `infrastructure/models.py`
ORM: Call (provider+external_id یکتا)، Recording (۱:۱ با call)، Transcript (۱:۱ با recording، segments JSONB)، WebhookLog (یکتا برای idempotency).

### `infrastructure/repository.py`
`WebhookLogRepository.upsert` با `on_conflict_do_nothing`. `CallRepository`: `match_or_create_student` با موبایل، `upsert_call` با نگاشت وضعیت، `add_activity`. هر کدام SessionLocal مستقل.

### `infrastructure/factory.py`
انتخاب WorkanoProvider یا SimotelProvider بر اساس `TELEPHONY_PROVIDER`.

### `infrastructure/simotel/provider.py`
parse وب‌هوک سیموتل. رویدادها: IncomingCall/OutgoingCall/CDRQueue. سه روش احراز (HMAC، توکن هدر، توکن بدنه). `_recording_url()` لینک کامل را از نام فایل می‌سازد.

### `infrastructure/workano/provider.py`
parse وب‌هوک Workano (ساختار ساده‌تر). تأیید امضای HMAC-SHA256، نگاشت مستقیم فیلدها با `_EVENT_MAP`.

---

## ماژول ai_analysis (تحلیل هوش مصنوعی)

### `api/routes.py`
`GET /ai/calls/{call_id}/analysis` — آخرین امتیاز سرنخ، احتمال ثبت‌نام، اقدام بعدی، سیگنال‌ها (پشت مجوز `ai:read`).

### `application/analyze_call.py`
`AnalyzeCallUseCase.execute()` — اجرای پایپ‌لاین LangGraph (call_id، audio، student_id، history) و برگرداندن `CallAnalysisResult`. ساخت state اولیه و marshal خروجی.

### `application/run_pipeline.py`
نقطه‌ی ورود تسک Celery: (۱) خواندن تماس + recording_url، (۲) دانلود صوت، (۳) آپلود S3، (۴) خواندن تاریخچه (۵ امتیاز آخر)، (۵) اجرای UseCase، (۶) ذخیره‌ی transcript/lead_score/stage.

### `application/ports.py`
اینترفیس‌ها: `LLMProvider.complete(system, user, schema?)` (خروجی ساختاریافته با schema)، `SpeechToTextProvider.transcribe(audio)`.

### `domain/models.py`
مدل‌های دامنه: `ExtractedInfo` (نام/دوره/هدف/قصد ثبت‌نام/اعتراضات/سیگنال‌ها + **confidence** که اطمینان پایین → نیاز به بازبینی)، `LeadScoreResult` (۰-۱۰۰ + احتمال)، `StageSuggestion`، `FollowUpSuggestion`، `ManagerSummary`، `CallAnalysisResult` (تجمیع نهایی + needs_review).

### `infrastructure/models.py`
ORM جدول lead_scores: student_id، call_id، score، registration_probability، signals (JSONB)، next_best_action.

### `infrastructure/repository.py`
دسترسی داده: `get_call`، `save_recording`، `get_history` (۵ امتیاز آخر)، `save_analysis` (transcript+lead_score در تراکنش)، `get_latest_analysis`.

### `infrastructure/providers/avalai.py`
پیاده‌سازی AvalAI (سازگار OpenAI). `AvalAILLMProvider` با خروجی ساختاریافته (`.parse()`) + retry نمایی؛ temperature=0.2. `AvalAIWhisperProvider` با segmentها از پاسخ verbose_json.

### `infrastructure/providers/factory.py`
`get_llm_provider` / `get_stt_provider` بر اساس `ai_provider`.

### `infrastructure/langgraph/graph.py`
ساخت گراف: transcript → extract → score → stage → followup → manager. edge شرطی: اگر متن < ۲۰ کاراکتر → review (END).

### `infrastructure/langgraph/nodes.py`
گره‌ها (factory): transcript (STT + مدیریت صوت گمشده)، extraction (+confidence)، scoring (۰-۱۰۰ با تاریخچه)، stage (۷ گزینه)، followup (تاریخ ISO)، manager (خلاصه + اقدام بعدی). همه‌ی خطاها در `state["errors"]`.

### `infrastructure/langgraph/state.py`
TypedDict (`total=False`): ورودی‌ها (call_id، audio، history)، میانی‌ها (transcript، extracted، lead_score، …)، کنترل (errors، needs_review، status).

---

## ماژول analytics (داشبورد/گزارش)

### `api/routes.py`
endpointهای داشبورد: summary، funnel، team، calls-trend، followups/today، tasks، missing-next-call، daily-report، daily-performance، hourly، monthly-performance. کش‌شده با `cached_json` (۳۰-۶۰s).

### `application/dashboard_service.py`
کوئری‌های تجمیع. `summary` (سرنخ داغ≥۷۰/گرم۴۰-۶۹/سرد<۴۰ + نرخ تبدیل). `funnel` (دانشجو در هر مرحله). `team_performance`. `calls_trend`. `daily_report` (شمارش نتایج). `monthly_performance` (امتیاز وزنی: فروش۴۰٪+تماس۲۵٪+دقیقه۲۰٪+followup۱۵٪ + ماه مالی شمسی). `hourly_stats` (timezone تهران).

---

## ماژول assistant (دستیار)

### `api/routes.py`
`POST /ai/assistant/query` — پیام زبان طبیعی → پاسخ + intent + دانشجویان مرتبط.

### `application/assistant_service.py`
LLM پیام را به intent نگاشت می‌کند (call_today، likely_to_register، interested_in_course، price_objections، no_followup_n_days، unknown)، سپس به کوئری Repository می‌سپارد و پاسخ را قالب‌بندی می‌کند.

### `infrastructure/repository.py`
کوئری‌های پارامتری امن (ضد SQL injection): `followups_due_today`، `high_probability`، `interested_in`، `with_price_objection`، `no_followup_since`.

---

## ماژول loyalty (باشگاه مشتریان) — اختیاری و حذف‌شدنی

> ⭐ کاملاً مستقل: بدونِ FK سختِ هسته، جدول‌های `loyalty_*`، سوییچِ `LOYALTY_ENABLED`.
> حذفِ کامل = پاک‌کردنِ پوشه + downgradeِ migration `0010`. مرجع: [`12-LOYALTY-CLUB.md`](12-LOYALTY-CLUB.md).

### `infrastructure/models.py`
ORM جدول‌های loyalty: `LoyaltyAccount` (امتیاز/سطح/کد دعوت — student_id نرم)، `PointTransaction`
(Ledger با idempotency_key یکتا)، `LoyaltyLevel`/`LoyaltyRule` (پیکربندیِ داده‌ای)، `LoyaltyEvent`
(لاگ با dedup_key)، `LoyaltyCheckpoint` (نشانگرِ اسکن). هیچ FK سختی به جدول‌های هسته ندارد.

### `application/rule_engine.py`
موتورِ **قطعیِ خالص** (بدون DB، تست‌پذیر): `conditions_match` (AND روی شرط‌ها)، `compute_points`
(fixed/ratio/tiered)، `evaluate_rule` (شرط نگرفت→None، وگرنه امتیاز). هیچ LLM/تصادفی‌ای نیست.

### `application/rewards.py` (فاز۲)
منطقِ خالصِ پاداش/معرفی (تست‌پذیر، بدون DB): `check_redeem` (کفایتِ امتیاز/سطح/موجودی)،
`check_referral` (ضدِخودمعرفی/تکراری)، `gen_coupon` (کدِ کوپنِ خوانا).

### `application/loyalty_service.py`
`get_or_create_account` (+کد دعوتِ یکتا)، `process_event` (اجرای قوانینِ فعالِ همان event_type،
ثبتِ تراکنش با `idempotency_key` = dedup+rule → ضدِ دوباره‌شماری؛ + قلابِ پاداشِ خریدِ معرفی)،
`_recompute` (موجودی/سطح از Ledger)، `account_profile`/`transactions`/`leaderboard`/`levels`.
**فاز۲:** `rewards`/`redeem`/`redemptions` (مصرفِ امتیاز→کوپن)، `apply_referral` (معرف +۳۰۰ +
کوپنِ ۵٪)، `_reward_referral_purchase` (معرف +۵۰۰ روی خریدِ معرفی‌شده، یک‌بار).

### `application/projection.py`
اتصالِ **صفر-دست‌زدن به هسته**: با SQL خام جدول‌های `sales`/`calls` را از checkpoint می‌خواند و
به `process_event` می‌دهد (dedup_key = `sale:{id}`/`call:{id}`). عمداً مدل‌های هسته را import نمی‌کند.

### `api/routes.py`
`/api/v1/loyalty`: `GET accounts/{id}`، `accounts/{id}/transactions`، `leaderboard`، `levels`،
`POST scan` (projection دستی/ادمین)، `POST events` (تزریقِ دستیِ رویداد). از مجوزهای موجودِ
`students:read|write` استفاده می‌کند (بدونِ افزودنِ permission به seed هسته).

> ثبت در `app/main.py`: بلاکِ `if settings.loyalty_enabled: try: include_router(...)` — با
> try/except تا حذفِ پوشه، برنامه را نشکند.

---

## فرانت‌اند

### lib/

#### `lib/api.ts`
کلاینت Axios. سوییچ حالت دمو با `NEXT_PUBLIC_DEMO` (GETها → داده‌ی دمو بدون بک‌اند). interceptor توکن (تزریق Bearer از localStorage + رفرش خودکار روی 401 + ریدایرکت به login).

#### `lib/auth.ts`
رمزگشایی payload توکن (بدون تأیید امضا — تأیید واقعی سمت سرور). `getSession`، `isDemoMode`، `isAuthenticated`، `isManager`، `hasPerm`. در دمو نقش پیش‌فرض sales_manager (قابل override با `demo_role`).

#### `lib/demoData.ts`
داده‌ی نمونه برای همه‌ی صفحات + `demoByPath` (نگاشت مسیر API → داده). شامل دانشجو، تماس، فروش، followup، گزارش‌ها، تایم‌لاین، مشتریان چندبارخرید، عملکرد ماهانه.

#### `lib/utils.ts`
کمک‌توابع فارسی: `faNum` (عدد با جداکننده)، `faDigits` (لاتین→فارسی)، `faDuration` (ثانیه→MM:SS)، `faDateTime` (ISO→تاریخ کوتاه فارسی)، `cn` (ادغام کلاس Tailwind).

#### `lib/exportExcel.ts`
خروجی CSV با BOM برای اکسل فارسی. `exportToExcel()` + `ExcelColumn`. ارقام فارسی→لاتین، escape، دانلود با blob.

### app/

#### `app/layout.tsx`
ریشه HTML: `lang=fa dir=rtl`، فونت Vazirmatn، manifest PWA + آیکن iOS، رندر Providers + ServiceWorkerRegister، پشتیبانی basePath.

#### `app/providers.tsx`
`QueryClientProvider` (تک نمونه QueryClient).

#### `app/page.tsx`
ریدایرکت `/` → `/tasks`.

#### `app/login/page.tsx`
فرم دوتب: OTP (موبایل→کد ۵رقمی) یا ایمیل+رمز. در دمو بک‌اند رد می‌شود. ذخیره‌ی توکن در localStorage.

#### `app/globals.css`
تم تیره: `--background:#334766`، `--foreground:#e2e8f0`. کلاس‌های `.card`/`.btn`/`.panel`/`.panel-toolbar`، اسکرول‌بار نازک.

#### `app/dashboard/layout.tsx`
چیدمان صفحات محافظت‌شده: Sidebar + main، ریسپانسیو `flex-col md:flex-row`.

#### `app/dashboard/page.tsx`
داشبورد مدیر: کارت‌های summary، نمودار Area روند ۷روزه، دونات سرنخ، قیف فروش، جدول followupهای امروز. داده با React Query.

#### `app/students/page.tsx`
پایگاه سرنخ: جستجو/فیلتر رشته، مرتب‌سازی بر اساس امتیاز، نشان‌های رنگی، **تعداد تماس کنار نام**، مودال پیام (SMS→`/messages`؛ واتساپ/تلگرام→باز کردن اپ)، خروجی.

#### `app/calls/page.tsx`
لاگ تماس با خلاصه‌ی AI: فیلتر جهت/وضعیت، نشان اطمینان٪، سیگنال‌ها، مودال ثبت نتیجه (+تاریخ تماس بعدی → followup). invalidate روی ثبت.

#### `app/sales/page.tsx`
لیست فیش فروش + فرم ثبت: صفحه‌بندی، فیلتر روش پرداخت، dropdown مدت فقط برای «برنامه»، جمع‌های تفکیکی. در دمو alert.

#### `app/tasks/page.tsx`
هاب روزانه: followupهای امروز، تماس‌های بدون اقدام، بی‌پاسخ، یادآور تمدید (≤۲ روز قرمز)، `NextCallNag` (هر ۵.۵ دقیقه)، فرم ثبت سریع شماره.

#### `app/followups/page.tsx`
چک‌لیست پیگیری: نرمال‌سازی دو فرمت تاریخ (دمو/واقعی)، مرتب‌سازی بر اساس نزدیک‌ترین، صفحه‌بندی، جستجو.

#### `app/reports/page.tsx`
گزارش‌های مدیر-only (غیرمدیر → صفحه‌ی قفل): گزارش روزانه، رتبه‌بندی تیم، جدول عملکرد روزانه/ماهانه، آمار ساعتی، گزارش ارتباطات (با فیلتر تاریخ)، داده‌ی ناقص، تایم‌لاین خرید، **مشتریان چندبارخرید** (فاصله‌ی بین خریدها) + خروجی اکسل هر بخش.

#### `app/users/page.tsx`
مدیریت کاربران: لیست + نشان نقش، toggle فعال/غیرفعال، مودال افزودن. در دمو alert.

#### `app/assistant/page.tsx`
چت‌بات: نمونه‌سؤال‌ها، رابط چت، ارسال به `/ai/assistant/query`، رندر دانشجویان با درصد احتمال.

### components/

| فایل | نقش |
|---|---|
| `Sidebar.tsx` | ناوبری با visibility بر اساس نقش + drawer موبایل + گارد ورود |
| `AuthGuard.tsx` | بلاک محتوا تا احراز هویت (اغلب با Sidebar پوشش داده شده) |
| `ContactLinks.tsx` | لینک واتساپ (`wa.me`) + تلگرام (`tg://resolve`)؛ تبدیل موبایل به فرمت بین‌المللی |
| `CallButton.tsx` | دکمه‌ی تماس `tel:` + callback اختیاری برای Click-to-Call سیموتل |
| `StatCard.tsx` | کارت آماری رنگی (۶ تُن) با آیکن و hint |
| `ChartCard.tsx` | قاب نمودار (عنوان/زیرعنوان + children) |
| `ScoreLegend.tsx` | راهنمای رنگ امتیاز (داغ/گرم/سرد) |
| `Pagination.tsx` | قبلی/بعدی + شمارنده (RTL، مخفی اگر یک صفحه) |
| `ExportButton.tsx` | خروجی CSV داده‌ی فعلی |
| `ExportAllButton.tsx` | خروجی کاملِ همه‌ی رکوردها از endpoint (در دمو alert) |
| `ServiceWorkerRegister.tsx` | ثبت SW برای PWA (با basePath) |
| `BackButton.tsx` | دکمه‌ی برگشت RTL (فلش راست)، حالت `dark` |

---

> نکته‌ی نگه‌داری: هر فایل/تابع جدید را همین‌جا ثبت کنید (طبق قانون طلایی #۷ در `MEMORY.md`:
> «همیشه کدها را داکیومنت کن»). این سند را با تغییرات مهم به‌روز نگه دارید.
