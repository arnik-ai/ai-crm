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
