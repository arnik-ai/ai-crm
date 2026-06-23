import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** ادغام امن کلاس‌های Tailwind. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** فرمت عدد فارسی با جداکننده هزارگان. */
export function faNum(n: number | string): string {
  return Number(n).toLocaleString("fa-IR");
}

const _FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
/** تبدیل ارقام انگلیسی یک رشته به فارسی (بدون تغییر بقیه‌ی کاراکترها). */
export function faDigits(s: string | number): string {
  return String(s).replace(/[0-9]/g, (d) => _FA_DIGITS[+d]);
}

/** فرمت مدت تماس به صورت دقیقه:ثانیه — مثل ۰۰:۵۸ یا ۰۸:۵۲. */
export function faDuration(sec?: number): string {
  if (!sec || sec <= 0) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return faDigits(`${mm}:${ss}`);
}

/** فرمت تاریخ/زمان فارسی کوتاه. */
export function faDateTime(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("fa-IR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
