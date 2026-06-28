"use client";
import { MessageCircle, Send } from "lucide-react";

/**
 * لینک‌های سریع پیام‌رسان کنار هر مخاطب: واتساپ و تلگرام.
 *
 * - واتساپ: لینک استاندارد wa.me (در مرورگر و موبایل کار می‌کند).
 * - تلگرام: اسکیمای tg://resolve?phone (اپ تلگرام دسکتاپ/موبایل را باز می‌کند).
 *
 * شماره به ارقام بین‌المللی بدون + تبدیل می‌شود (۰ ابتدایی → ۹۸).
 */
function toIntl(mobile: string): string {
  let d = mobile.replace(/\D/g, "");
  if (d.startsWith("0")) d = "98" + d.slice(1);
  return d;
}

export function ContactLinks({
  mobile,
  size = 16,
}: {
  mobile?: string | null;
  size?: number;
}) {
  if (!mobile) return null;
  const intl = toIntl(mobile);
  return (
    <span className="inline-flex items-center gap-1.5">
      <a
        href={`https://wa.me/${intl}`}
        target="_blank"
        rel="noopener noreferrer"
        title="پیام واتساپ"
        className="inline-flex items-center justify-center rounded-lg bg-emerald-50 p-1.5 text-emerald-600 transition hover:bg-emerald-100"
      >
        <MessageCircle size={size} />
      </a>
      <a
        href={`tg://resolve?phone=${intl}`}
        title="پیام تلگرام"
        className="inline-flex items-center justify-center rounded-lg bg-sky-50 p-1.5 text-sky-600 transition hover:bg-sky-100"
      >
        <Send size={size} />
      </a>
    </span>
  );
}
