# فرانت‌اند CRM — Next.js 15 (App Router)

## استک
Next.js 15 · React 19 · TypeScript · TailwindCSS · TanStack Query · Recharts · Lucide.
رابط کاربری **راست‌چین (RTL)** و فارسی.

## ساختار
```
frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx        # RTL + فونت فارسی + Providers
│   │   ├── page.tsx          # ریدایرکت به داشبورد
│   │   ├── login/            # ورود (JWT)
│   │   ├── dashboard/        # داشبورد + کارت KPI + قیف فروش
│   │   ├── students/         # فهرست دانشجو/سرنخ
│   │   ├── calls/            # تماس‌ها
│   │   └── assistant/        # دستیار چت CRM
│   ├── components/           # Sidebar و UI مشترک
│   └── lib/api.ts            # کلاینت axios + refresh خودکار توکن
```

## اجرای محلی
```bash
cp .env.example .env.local
npm install
npm run dev        # http://localhost:3000
```
درخواست‌های `/api/*` به بک‌اند (`NEXT_PUBLIC_API_BASE`) پراکسی می‌شوند.

## استقرار روی Parspack
- اپ Node.js؛ فرمان build: `npm run build`، فرمان start: `npm run start`.
- متغیر `NEXT_PUBLIC_API_BASE` به آدرس بک‌اند تنظیم شود.
