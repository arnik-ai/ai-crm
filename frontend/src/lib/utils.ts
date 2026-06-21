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

/** فرمت مدت تماس (ثانیه) به صورت خوانا: «۶ دقیقه و ۱۲ ثانیه». */
export function faDuration(sec?: number): string {
  if (!sec || sec <= 0) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${faNum(s)} ثانیه`;
  if (s === 0) return `${faNum(m)} دقیقه`;
  return `${faNum(m)} دقیقه و ${faNum(s)} ثانیه`;
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
