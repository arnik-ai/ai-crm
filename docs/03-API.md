# طراحی REST API

> نسخه ۱.۰ | پایه: `/api/v1` | احراز هویت: `Authorization: Bearer <access_token>` | فرمت: JSON

## ۱. اصول
- نسخه‌بندی در مسیر (`/api/v1`).
- صفحه‌بندی استاندارد: `?page=1&size=20` → پاسخ `{items, total, page, size}`.
- خطاها: ساختار یکدست `{detail, code, errors?}` با کد HTTP مناسب.
- اعتبارسنجی ورودی با Pydantic v2 (در لایه‌ی Presentation).
- همه‌ی Endpointها (جز Auth/Webhook) نیازمند JWT + بررسی RBAC.

## ۲. ماژول‌ها و Endpointها

### Auth (`/api/v1/auth`)
| متد | مسیر | توضیح |
|---|---|---|
| POST | `/login` | ورود → access + refresh |
| POST | `/refresh` | تمدید توکن (rotation) |
| POST | `/logout` | ابطال refresh |
| GET | `/me` | پروفایل کاربر جاری |

```http
POST /api/v1/auth/login
{ "email": "agent@inst.ir", "password": "••••••" }

200 OK
{ "access_token": "eyJ...", "refresh_token": "eyJ...", "token_type": "bearer", "expires_in": 900 }
```
قواعد اعتبارسنجی: `email` فرمت ایمیل، `password` حداقل ۸ کاراکتر. خطای ورود: `401 {"detail":"invalid credentials","code":"AUTH_INVALID"}`.

### Students (`/api/v1/students`)
| متد | مسیر | توضیح |
|---|---|---|
| GET | `/` | فهرست با فیلتر (`stage`, `agent`, `status`, `tag`, `q`) |
| POST | `/` | ایجاد سرنخ |
| GET | `/{id}` | جزئیات + تایم‌لاین |
| PATCH | `/{id}` | به‌روزرسانی |
| DELETE | `/{id}` | حذف نرم |
| POST | `/{id}/stage` | تغییر مرحله‌ی فروش |
| GET | `/{id}/calls` | تماس‌های دانشجو |
| GET | `/{id}/scores` | تاریخچه‌ی Lead Score |

```http
POST /api/v1/students
{ "full_name": "سارا محمدی", "mobile": "+989121234567",
  "course_interest_id": "...", "lead_source": "تماس ورودی" }

201 Created
{ "id": "8f2c...", "full_name": "سارا محمدی", "mobile": "+989121234567",
  "sales_stage": "New Lead", "status": "active", "created_at": "2026-06-21T10:00:00Z" }
```
قواعد: `mobile` با regex `^\+98\d{10}$` نرمال و یکتا؛ تکراری → `409 {"code":"STUDENT_DUPLICATE"}`.

### Calls (`/api/v1/calls`)
| متد | مسیر | توضیح |
|---|---|---|
| GET | `/` | فهرست تماس‌ها (فیلتر direction/status/date) |
| GET | `/{id}` | جزئیات + recording + transcript + summary |
| GET | `/{id}/recording` | URL امضاشده‌ی S3 برای پخش |
| POST | `/{id}/reanalyze` | اجرای مجدد پایپ‌لاین AI |

### Courses / Notes / Tags / Followups
- `Courses`: CRUD دوره‌ها.
- `Notes`: `GET/POST /students/{id}/notes`.
- `Tags`: CRUD تگ + `POST /students/{id}/tags`.
- `Followups`: `GET /` (با فیلتر `due`, `owner`, `status`), `POST /`, `PATCH /{id}` (علامت done).

```http
GET /api/v1/followups?status=pending&due_before=2026-06-28
200 OK
{ "items": [ { "id":"...", "student": {"full_name":"سارا محمدی"},
   "due_at":"2026-06-25T09:00:00Z", "note":"ارسال طرح اقساط" } ], "total": 1 }
```

### Dashboard (`/api/v1/dashboard`)
| متد | مسیر | توضیح |
|---|---|---|
| GET | `/summary` | کارت‌ها: calls today/week، hot/warm/cold، conversion rate |
| GET | `/funnel` | توزیع سرنخ در مراحل |
| GET | `/team` | عملکرد کارشناسان |
| GET | `/followups/today` | پیگیری‌های امروز |

```http
GET /api/v1/dashboard/summary
200 OK
{ "calls_today": 42, "calls_week": 318, "hot_leads": 17, "warm_leads": 54,
  "cold_leads": 120, "followups_today": 9, "conversion_rate": 0.23 }
```

### AI Analysis (`/api/v1/ai`)
| متد | مسیر | توضیح |
|---|---|---|
| GET | `/calls/{id}/analysis` | نتیجه‌ی LangGraph برای تماس |
| POST | `/assistant/query` | دستیار چت CRM (NL → پاسخ) |

```http
POST /api/v1/ai/assistant/query
{ "message": "کدام دانشجوها احتمال ثبت‌نام بالایی دارند؟" }

200 OK
{ "answer": "۵ سرنخ با احتمال بالای ۷۰٪ ...",
  "students": [ {"id":"...","full_name":"سارا محمدی","registration_probability":0.72} ] }
```
نمونه‌پرسش‌های پشتیبانی‌شده: «امروز با چه کسانی تماس بگیرم؟»، «دانشجوهای علاقه‌مند به پایتون»،
«سرنخ‌های با اعتراض قیمتی»، «سرنخ‌های بدون پیگیری در ۷ روز اخیر».

### Workano Webhooks (`/api/v1/webhooks/workano`)
| متد | مسیر | توضیح |
|---|---|---|
| POST | `/` | دریافت رخدادهای Workano (با امضای HMAC) |

جزئیات کامل در [`04-WORKANO.md`](04-WORKANO.md).

## ۳. کدهای خطای استاندارد
| HTTP | code | معنا |
|---|---|---|
| 400 | `VALIDATION_ERROR` | ورودی نامعتبر |
| 401 | `AUTH_INVALID` / `TOKEN_EXPIRED` | احراز هویت |
| 403 | `FORBIDDEN` | عدم دسترسی RBAC |
| 404 | `NOT_FOUND` | منبع یافت نشد |
| 409 | `*_DUPLICATE` / `CONFLICT` | تعارض |
| 422 | `UNPROCESSABLE` | منطق کسب‌وکار |
| 429 | `RATE_LIMITED` | محدودیت نرخ |
| 500 | `INTERNAL` | خطای سرور |
