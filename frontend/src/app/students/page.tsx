"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { isDemoMode } from "@/lib/auth";
import { Sidebar } from "@/components/Sidebar";
import { BackButton } from "@/components/BackButton";
import { ExportButton } from "@/components/ExportButton";
import { ExportAllButton } from "@/components/ExportAllButton";
import type { ExcelColumn } from "@/lib/exportExcel";
import { useToast } from "@/components/Toast";
import { Search, Users, GraduationCap, X, Loader2, UserPlus, ChevronLeft } from "lucide-react";

const DEMO = isDemoMode();

// گزینه‌های ثابت (هم‌خوان با enumهای بک‌اند) برای فرم افزودن
const FIELDS = ["تجربی", "ریاضی", "انسانی", "سایر"];
const GRADES = ["دهم", "یازدهم", "دوازدهم", "فارغ‌التحصیل", "سایر"];
const SOURCES = ["سایت", "اینستاگرام", "تلگرام", "روبیکا", "بله", "پیامک", "سایر"];

type Student = {
  id: string;
  full_name: string | null;
  mobile: string;
  status: string;
  course?: string;        // دمو
  field?: string | null;  // بک‌اند (رشته)
  grade?: string;
  goal?: string;
  gpa?: number | null;
  city?: string;
  lead_source?: string;
  call_count?: number;
  lead_score?: number;
  stage?: string;
};

/** آواتار رنگی با حرف اول نام (رنگ ثابت بر اساس نام). */
const AVATAR_TONES = [
  "bg-blue-100 text-blue-600",
  "bg-emerald-100 text-emerald-600",
  "bg-violet-100 text-violet-600",
  "bg-amber-100 text-amber-600",
  "bg-rose-100 text-rose-600",
];
function Avatar({ name }: { name: string | null }) {
  const ch = (name ?? "?").trim().charAt(0) || "?";
  const idx = (name ?? "").length % AVATAR_TONES.length;
  return (
    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${AVATAR_TONES[idx]}`}>
      {ch}
    </div>
  );
}

const FILTERS = ["همه", "تجربی", "ریاضی", "انسانی"];
// فیلترِ پایه (تفکیکِ دهمی/یازدهمی/… ) — «سایر» هم‌خوان با enum بک‌اند
const GRADE_FILTERS = ["همه", "دهم", "یازدهم", "دوازدهم", "فارغ‌التحصیل", "سایر"];

// ستون‌های خروجی اکسل دانشجویان (خروجی همچنان کامل است، فقط نمایشِ لیست ساده شد)
const EXCEL_COLUMNS: ExcelColumn<Student>[] = [
  { key: "full_name", label: "نام و نام خانوادگی" },
  { key: "mobile", label: "موبایل" },
  { key: "city", label: "شهر" },
  { key: "course", label: "رشته" },
  { key: "grade", label: "پایه" },
  { key: "goal", label: "هدف" },
  { key: "gpa", label: "معدل", format: (s) => s.gpa ?? "" },
  { key: "lead_source", label: "منبع تماس" },
  { key: "call_count", label: "تعداد تماس" },
  { key: "lead_score", label: "امتیاز" },
  { key: "stage", label: "مرحله فروش" },
  { key: "status", label: "وضعیت" },
];

export default function StudentsPage() {
  const { data } = useQuery({
    queryKey: ["students"],
    queryFn: async () => (await api.get("/students")).data,
  });

  const [q, setQ] = useState("");
  const [field, setField] = useState("همه");
  const [grade, setGrade] = useState("همه");
  const [showAdd, setShowAdd] = useState(false);

  const items: Student[] = useMemo(() => {
    let list: Student[] = data?.items ?? [];
    if (field !== "همه") list = list.filter((s) => (s.course ?? s.field) === field);
    if (grade !== "همه") list = list.filter((s) => s.grade === grade);
    if (q.trim()) {
      const k = q.trim();
      list = list.filter(
        (s) => (s.full_name ?? "").includes(k) || s.mobile.includes(k)
      );
    }
    // مرتب‌سازی: بالاترین امتیاز اول (مهم‌ها بالای لیست)
    return [...list].sort((a, b) => (b.lead_score ?? 0) - (a.lead_score ?? 0));
  }, [data, q, field, grade]);

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar />
      <main className="flex-1 p-4 md:p-8">
        {/* سرتیتر */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 text-white shadow-md shadow-blue-200">
              <Users size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-white">دانشجویان / سرنخ‌ها</h1>
              <p className="mt-0.5 text-sm text-slate-300">{faStr(items.length)} مورد · روی هر نفر بزن تا جزئیاتش باز شود</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowAdd(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 active:scale-95"
            >
              <UserPlus size={16} /> افزودن
            </button>
            <ExportButton rows={items} columns={EXCEL_COLUMNS} filename="دانشجویان" />
            <ExportAllButton endpoint="/students/export" filename="همه-دانشجویان" />
            <BackButton dark />
          </div>
        </div>

        {/* نوار جستجو و فیلتر */}
        <div className="panel-toolbar mb-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 sm:max-w-xs">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="جستجوی نام یا موبایل…"
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-9 pl-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </div>
          {/* تفکیک بر اساس رشته — منوی کشویی */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-slate-400">رشته:</span>
            <select
              value={field}
              onChange={(e) => setField(e.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-400"
            >
              {FILTERS.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
          {/* تفکیک بر اساس پایه (دهم/یازدهم/…) — منوی کشویی */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-slate-400">پایه:</span>
            <select
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none transition focus:border-emerald-400"
            >
              {GRADE_FILTERS.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>
        </div>

        {/* لیستِ ساده: فقط نام + موبایل؛ کلیک روی هر نفر → صفحه‌ی جزئیات */}
        <div className="overflow-hidden rounded-2xl border border-indigo-100 bg-white shadow-sm">
          {items.map((s) => (
            <Link
              key={s.id}
              href={`/students/detail?id=${s.id}`}
              className="flex items-center gap-3 border-b border-slate-100 p-3.5 transition last:border-0 hover:bg-indigo-50/60"
            >
              <Avatar name={s.full_name} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 font-medium text-slate-700">
                  {s.full_name || "بدون نام"}
                  {s.status !== "active" && (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-400">غیرفعال</span>
                  )}
                </div>
                <div className="text-xs text-slate-400" dir="ltr">{s.mobile}</div>
              </div>
              <span className="shrink-0 text-xs text-slate-400">مشاهده</span>
              <ChevronLeft size={18} className="shrink-0 text-slate-300" />
            </Link>
          ))}

          {/* حالت خالی */}
          {items.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-slate-400">
              <GraduationCap size={40} className="opacity-40" />
              <p className="text-sm">دانشجویی مطابق جستجوی شما یافت نشد.</p>
            </div>
          )}
        </div>

        {showAdd && <AddStudentModal onClose={() => setShowAdd(false)} />}
      </main>
    </div>
  );
}

/** عددِ فارسی ساده (بدون وابستگی؛ فقط برای شمارنده‌ی سرتیتر). */
function faStr(n: number): string {
  return n.toLocaleString("fa-IR");
}

/* ---------- مودال افزودن دانشجو / شماره‌ی جدید ---------- */
function AddStudentModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  const [fld, setFld] = useState("");
  const [grade, setGrade] = useState("");
  const [source, setSource] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      if (DEMO) {
        alert("در حالت نمایشی، افزودن ذخیره نمی‌شود.");
        onClose();
        return;
      }
      await api.post("/students", {
        full_name: fullName || null,
        mobile,
        field: fld || null,
        grade: grade || null,
        lead_source: source || null,
      });
      qc.invalidateQueries({ queryKey: ["students"] });
      qc.invalidateQueries({ queryKey: ["today-leads"] });
      toast("شماره ثبت شد ✓");
      onClose();
    } catch {
      setError("ثبت ناموفق بود (شاید شماره تکراری است).");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-bold text-slate-800">
            <UserPlus size={18} className="text-blue-600" /> افزودن دانشجو / شماره
          </h2>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <input
            placeholder="نام و نام خانوادگی (اختیاری)"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
          <input
            type="tel"
            placeholder="موبایل (مثلاً ۰۹۱۲۳۴۵۶۷۸۹)"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            dir="ltr"
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <select value={fld} onChange={(e) => setFld(e.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-400">
              <option value="">رشته…</option>
              {FIELDS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
            <select value={grade} onChange={(e) => setGrade(e.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-400">
              <option value="">پایه…</option>
              {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <select value={source} onChange={(e) => setSource(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-400">
            <option value="">منبع…</option>
            {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          {error && <div className="text-sm text-rose-600">{error}</div>}
          <button
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            ثبت
          </button>
        </form>
      </div>
    </div>
  );
}
