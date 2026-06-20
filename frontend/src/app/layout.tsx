import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "CRM هوشمند مؤسسات آموزشی",
  description: "CRM هوش‌مصنوعی‌محور با یکپارچه‌سازی تلفنی و تحلیل تماس",
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
