# یکپارچه‌سازی تلفنی سیموتل (Simotel)

> نسخه ۱.۰ | مبتنی بر Simotel Webhooks
> مرجع رسمی: https://wiki.simotel.com/developers/SimotelWebhooks

## ۱. چرا افزودن سیموتل ساده بود؟
از ابتدا لایه‌ی انتزاع `TelephonyProvider` را ساختیم. سیموتل فقط **یک کلاس جدید** است
(`SimotelProvider`) و هیچ تغییری در دامنه، Use Caseها یا پایپ‌لاین AI لازم نشد —
این دقیقاً اصل Open/Closed است.

برای فعال‌سازی فقط کافی است در `.env`:
```env
TELEPHONY_PROVIDER=simotel
```

## ۲. رویدادهای سیموتل و نگاشت آن‌ها

سیموتل سه رویداد اصلی را به‌صورت Webhook می‌فرستد:

| رویداد سیموتل | فیلدهای کلیدی | نگاشت در CRM |
|---|---|---|
| **IncomingCall** | `event_name`, `number`, `unique_id`, `entry_point` | `incoming` |
| **OutgoingCall** | `event_name`, `number`, `unique_id`, `exit_point` | `outgoing` |
| **CDRQueue** | `unique_id`, `src`, `dst`, `billsec`, `duration`, `disposition`, `record`, `starttime`, `endtime` | بسته به وضعیت ↓ |

منطق نگاشت **CDRQueue** (پایان تماس):
- `disposition != ANSWERED` → **missed** (تماس ازدست‌رفته + پیگیری خودکار)
- دارای `record` (فایل ضبط mp3) → **recording_ready** → پایپ‌لاین AI فعال می‌شود
- بدون `record` → **finished**

## ۳. نمونه Payload رویداد CDRQueue (انتهای تماس)
```json
{
  "event_name": "CDRQueue",
  "token": "<SIMOTEL_WEBHOOK_TOKEN>",
  "unique_id": "1610782193.391",
  "src": "992",
  "dst": "993",
  "queue": "sales",
  "billsec": "31",
  "wait": "4",
  "duration": "35",
  "disposition": "ANSWERED",
  "record": "20210116_1610782193.391.mp3",
  "starttime": "1610782193",
  "endtime": "1610782224",
  "answeredtime": "1610782197",
  "ringtime": "1610782193"
}
```
> فیلد `record` نام فایل ضبط است؛ CRM آدرس کامل دانلود را با `SIMOTEL_API_BASE` می‌سازد:
> `https://<SIMOTEL_API_BASE>/records/20210116_1610782193.391.mp3`

## ۴. امنیت Webhook سیموتل
سیموتل امضای HMAC استاندارد ندارد؛ بنابراین سه لایه پشتیبانی می‌شود (به ترتیب اولویت):
۱. **HMAC** (اگر یک reverse-proxy جلوی سیموتل امضا اضافه کند) — هدر `X-Simotel-Signature`.
۲. **توکن در هدر** — `X-Simotel-Token`.
۳. **توکن در بدنه‌ی JSON** — فیلد `token` (رایج‌ترین حالت سیموتل).

پس در پنل سیموتل، فیلد `token` را با همان مقدار `SIMOTEL_WEBHOOK_TOKEN` تنظیم کن.

## ۵. تنظیمات Environment
```env
TELEPHONY_PROVIDER=simotel
SIMOTEL_WEBHOOK_TOKEN=یک-رمز-قوی-دلخواه
SIMOTEL_API_BASE=https://pbx.yourcompany.ir/api
SIMOTEL_API_TOKEN=توکن-API-سیموتل-برای-دانلود-فایل
SIMOTEL_WEBHOOK_SECRET=   # فقط اگر proxy امضاگذار داری
```

## ۶. آدرس Webhook که در پنل سیموتل می‌گذاری
```
https://<آدرس-بک‌اند-تو>/api/v1/webhooks/simotel
```
این آدرس را برای هر سه رویداد (IncomingCall، OutgoingCall، CDRQueue) در پنل سیموتل ثبت کن.

## ۷. جریان کامل (مثل بقیه‌ی Providerها)
```
سیموتل → POST /webhooks/simotel → بررسی توکن → ثبت webhook_log (Idempotent)
       → upsert call + تطبیق دانشجو → اگر recording_ready → صف Celery
       → دانلود فایل از سیموتل → Whisper → GPT-5.5 → ذخیره در PostgreSQL → داشبورد
```

## ۸. تست
۱۰ تست واحد برای SimotelProvider نوشته شده (احراز توکن + parse هر سه رویداد):
`backend/tests/test_simotel_provider.py`

## ۹. بازگشت به Workano یا افزودن Provider دیگر
فقط مقدار `TELEPHONY_PROVIDER` را عوض کن (`workano` / `simotel`). برای Asterisk/Issabel هم
کافی است یک کلاس مشابه ساخته و در `factory.py` ثبت شود.
