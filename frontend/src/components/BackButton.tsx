"use client";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

/**
 * دکمه‌ی برگشت — RTL فارسی.
 * در چیدمان راست‌چین، فلش برگشت به سمت راست است (ArrowRight).
 * پیش‌فرض: به صفحه‌ی قبل برمی‌گردد. با dark می‌توان روی پس‌زمینه‌ی تیره روشنش کرد.
 */
export function BackButton({ dark = false }: { dark?: boolean }) {
  const router = useRouter();
  const tone = dark
    ? "bg-white/10 text-white ring-white/20 hover:bg-white/20"
    : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50";
  return (
    <button
      onClick={() => router.back()}
      className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium ring-1 transition ${tone}`}
      aria-label="بازگشت"
      title="بازگشت"
    >
      <ArrowRight size={16} />
      بازگشت
    </button>
  );
}
