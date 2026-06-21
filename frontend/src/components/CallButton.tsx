"use client";
import { Phone } from "lucide-react";

/**
 * دکمه‌ی تماس.
 *
 * حالت فعلی: لینک tel: — کلیک، شماره را برای گوشی/نرم‌افزار تلفن می‌گیرد.
 *
 * ارتقا به سیموتل (بعداً): کافی است یک تابع onCall بدهی که به API سیموتل
 * (Call Originate) درخواست بزند؛ آن‌وقت به‌جای لینک، دکمه‌ی واقعی Click-to-Call
 * می‌شود و تلفن میز کارشناس خودکار وصل می‌شود.
 */
export function CallButton({
  mobile,
  onCall,
  size = "md",
}: {
  mobile: string;
  onCall?: (mobile: string) => void;
  size?: "sm" | "md";
}) {
  const cls =
    "inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500 font-medium text-white transition hover:bg-emerald-600 active:scale-95 " +
    (size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-sm");

  // حالت سیموتل (Click-to-Call واقعی)
  if (onCall) {
    return (
      <button className={cls} onClick={() => onCall(mobile)} title="تماس از طریق سیموتل">
        <Phone size={size === "sm" ? 14 : 16} />
        تماس
      </button>
    );
  }

  // حالت پیش‌فرض: لینک tel:
  return (
    <a className={cls} href={`tel:${mobile}`} title={`تماس با ${mobile}`}>
      <Phone size={size === "sm" ? 14 : 16} />
      تماس
    </a>
  );
}
