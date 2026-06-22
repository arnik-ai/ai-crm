import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

// basePath روی GitHub Pages = /ai-crm ، لوکال = خالی. برای ساخت مسیر دارایی‌های PWA.
const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

export const metadata: Metadata = {
  title: "CRM هوشمند مؤسسات آموزشی",
  description: "CRM هوش‌مصنوعی‌محور با یکپارچه‌سازی تلفنی و تحلیل تماس",
  manifest: `${BASE}/manifest.webmanifest`,
  // آیکون نصب روی iOS (Add to Home Screen)
  appleWebApp: {
    capable: true,
    title: "CRM هوشمند",
    statusBarStyle: "default",
  },
  icons: {
    icon: `${BASE}/icon.svg`,
    apple: `${BASE}/icon.svg`,
  },
};

// تنظیمات نمایش روی موبایل (اندروید/iOS) — مقیاس درست و رنگ نوار بالای مرورگر
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#2563eb",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fa" dir="rtl">
      <body className="font-sans">
        <Providers>{children}</Providers>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
