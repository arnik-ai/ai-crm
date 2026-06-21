import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "CRM هوشمند مؤسسات آموزشی",
  description: "CRM هوش‌مصنوعی‌محور با یکپارچه‌سازی تلفنی و تحلیل تماس",
};

// تنظیمات نمایش روی موبایل (اندروید/iOS) — مقیاس درست و جلوگیری از زوم‌اوت ناخواسته
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
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
      </body>
    </html>
  );
}
