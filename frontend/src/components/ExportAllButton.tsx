"use client";
import { useState } from "react";
import { Database, Loader2 } from "lucide-react";
import { api } from "@/lib/api";

/**
 * دکمه‌ی «خروجی کامل (همه‌ی رکوردها)».
 *
 * بر خلاف ExportButton که فقط داده‌ی صفحه‌ی جاری را export می‌کند، این دکمه
 * یک endpoint استریم‌شده در بک‌اند را صدا می‌زند که کل دیتابیس را (مثلاً همه‌ی
 * ۱۰٬۰۰۰ دانشجو) در یک فایل اکسل می‌دهد.
 *
 * در حالت دمو (بدون بک‌اند) این endpoint وجود ندارد؛ پس اگر درخواست شکست خورد،
 * پیام مناسب نشان داده می‌شود (به‌جای خطای ناخوانا).
 */
export function ExportAllButton({
  endpoint,
  filename,
  label = "خروجی کامل",
}: {
  endpoint: string; // مثل "/students/export"
  filename: string;
  label?: string;
}) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const res = await api.get(endpoint, { responseType: "blob" });
      const blob = new Blob([res.data], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert(
        "خروجی کامل فقط زمانی کار می‌کند که به بک‌اند واقعی متصل باشید.\n" +
          "در حالت نمایشی (دمو) از دکمه‌ی «خروجی اکسل» استفاده کنید.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="inline-flex items-center gap-1.5 rounded-xl bg-slate-700 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
      title="دریافت خروجی اکسل از همه‌ی رکوردها (نه فقط این صفحه)"
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : <Database size={16} />}
      {label}
    </button>
  );
}
