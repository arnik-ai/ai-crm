"use client";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { isDemoMode } from "@/lib/auth";
import { Sidebar } from "@/components/Sidebar";
import { CallButton } from "@/components/CallButton";
import { ContactLinks } from "@/components/ContactLinks";
import { ScoreLegend } from "@/components/ScoreLegend";
import { BackButton } from "@/components/BackButton";
import { ExportButton } from "@/components/ExportButton";
import { ExportAllButton } from "@/components/ExportAllButton";
import type { ExcelColumn } from "@/lib/exportExcel";
import { faNum } from "@/lib/utils";
import { useToast } from "@/components/Toast";
import { Search, Users, GraduationCap, Phone, MessageSquare, X, Loader2, Send, Pencil } from "lucide-react";

const DEMO = isDemoMode();

// گزینه‌های ثابت (هم‌خوان با enumهای بک‌اند) برای فرم ویرایش/تکمیل
const FIELDS = ["تجربی", "ریاضی", "انسانی", "سایر"];
const GRADES = ["دهم", "یازدهم", "دوازدهم", "فارغ‌التحصیل", "سایر"];
const SOURCES = ["سایت", "اینستاگرام", "تلگرام", "روبیکا", "بله", "پیامک", "سایر"];

type Student = {
  id: string;
  full_name: string | null;
  mobile: string;
  status: string;
  course?: string;        // دمو
  field?: string | null;  // بک‌اند (رشته) — برای نمایش از course ?? field استفاده می‌شود
  grade?: string;
  goal?: string;
  gpa?: number | null;
  city?: string;
  lead_source?: string;
  call_count?: number;
  lead_score?: number;
  stage?: string;
  last_call?: string;
};

/** کانال‌های پیام برای مودال ارسال پیام. */
const MSG_CHANNELS = [
  { v: "sms", label: "پیامک سامانه‌ای" },
  { v: "whatsapp", label: "واتساپ" },
  { v: "telegram", label: "تلگرام" },
];

/** شماره به ارقام بین‌المللی بدون + (۰ ابتدایی → ۹۸) برای لینک پیام‌رسان. */
function toIntl(mobile: string): string {
  let d = mobile.replace(/\D/g, "");
  if (d.startsWith("0")) d = "98" + d.slice(1);
  return d;
}

/** نشان رنگی رشته‌ی تحصیلی: تجربی / ریاضی / انسانی. */
function FieldBadge({ field }: { field?: string }) {
  if (!field) return <span className="text-slate-300">—</span>;
  const tone: Record<string, string> = {
    "تجربی": "bg-emerald-50 text-emerald-700 ring-emerald-100",
    "ریاضی": "bg-blue-50 text-blue-700 ring-blue-100",
    "انسانی": "bg-violet-50 text-violet-700 ring-violet-100",
  };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${tone[field] ?? "bg-slate-100 text-slate-600 ring-slate-200"}`}>
      {field}
    </span>
  );
}

/** نشان رنگی امتیاز سرنخ: داغ (سبز) / گرم (زرد) / سرد (آبی). */
function ScoreBadge({ score }: { score?: number }) {
  if (score == null) return <span className="text-slate-300">—</span>;
  const tone =
    score >= 70 ? "bg-emerald-500"
    : score >= 40 ? "bg-amber-500"
    : "bg-blue-500";
  return (
    <span className={`inline-flex min-w-[2.25rem] justify-center rounded-lg px-2 py-1 text-xs font-bold text-white shadow-sm ${tone}`}>
      {score}
    </span>
  );
}

/** نشان مرحله‌ی فروش. */
function StageBadge({ stage }: { stage?: string }) {
  if (!stage) return <span className="text-slate-300">—</span>;
  return (
    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
      {stage}
    </span>
  );
}

/** نشان رنگی منبع تماس (اینستاگرام/تلگرام/سایت/...). */
function SourceBadge({ source }: { source?: string }) {
  if (!source) return <span className="text-slate-300">—</span>;
  const tone: Record<string, string> = {
    "اینستاگرام": "bg-pink-50 text-pink-600",
    "تلگرام": "bg-sky-50 text-sky-600",
    "روبیکا": "bg-orange-50 text-orange-600",
    "بله": "bg-emerald-50 text-emerald-600",
    "پیامک": "bg-violet-50 text-violet-600",
    "سایت": "bg-blue-50 text-blue-600",
  };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${tone[source] ?? "bg-slate-100 text-slate-600"}`}>
      {source}
    </span>
  );
}

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
    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${AVATAR_TONES[idx]}`}>
      {ch}
    </div>
  );
}

const FILTERS = ["همه", "تجربی", "ریاضی", "انسانی"];

// ستون‌های خروجی اکسل دانشجویان
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
  // دانشجویی که مودال ارسال پیام برایش باز است
  const [msgStudent, setMsgStudent] = useState<Student | null>(null);
  // دانشجویی که مودال ویرایش/تکمیل برایش باز است
  const [editStudent, setEditStudent] = useState<Student | null>(null);

  const items: Student[] = useMemo(() => {
    let list: Student[] = data?.items ?? [];
    if (field !== "همه") list = list.filter((s) => (s.course ?? s.field) === field);
    if (q.trim()) {
      const k = q.trim();
      list = list.filter(
        (s) => (s.full_name ?? "").includes(k) || s.mobile.includes(k)
      );
    }
    // مرتب‌سازی: بالاترین امتیاز اول (مهم‌ها بالای لیست)
    return [...list].sort((a, b) => (b.lead_score ?? 0) - (a.lead_score ?? 0));
  }, [data, q, field]);

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
              <p className="mt-0.5 text-sm text-slate-300">{items.length} مورد · مرتب‌شده بر اساس امتیاز</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ExportButton rows={items} columns={EXCEL_COLUMNS} filename="دانشجویان" />
            <ExportAllButton endpoint="/students/export" filename="همه-دانشجویان" />
            <BackButton dark />
          </div>
        </div>

        {/* راهنمای رنگ امتیاز */}
        <ScoreLegend />

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
          <div className="flex gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setField(f)}
                className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                  field === f
                    ? "bg-blue-500 text-white shadow-sm shadow-blue-200"
                    : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* جدول */}
        <div className="overflow-x-auto rounded-2xl border border-indigo-100 bg-white shadow-sm">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-gradient-to-l from-sky-50 to-indigo-50 text-slate-600">
              <tr>
                <th className="p-3.5 text-right font-medium">دانشجو</th>
                <th className="p-3.5 text-right font-medium">شهر</th>
                <th className="p-3.5 text-right font-medium">رشته</th>
                <th className="p-3.5 text-right font-medium">پایه</th>
                <th className="p-3.5 text-right font-medium">هدف</th>
                <th className="p-3.5 text-center font-medium">معدل</th>
                <th className="p-3.5 text-right font-medium">منبع</th>
                <th className="p-3.5 text-center font-medium">امتیاز</th>
                <th className="p-3.5 text-right font-medium">مرحله</th>
                <th className="p-3.5 text-center font-medium">تماس‌ها</th>
                <th className="p-3.5 text-center font-medium">اقدام</th>
              </tr>
            </thead>
            <tbody>
              {items.map((s, i) => (
                <tr
                  key={s.id}
                  className={`border-t border-slate-100 transition hover:bg-indigo-50/60 ${
                    i % 2 === 1 ? "bg-slate-50/40" : ""
                  }`}
                >
                  {/* دانشجو: آواتار + نام + موبایل */}
                  <td className="p-3.5">
                    <div className="flex items-center gap-3">
                      <Avatar name={s.full_name} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 font-medium text-slate-700">
                          {s.full_name ?? "—"}
                          {s.status !== "active" && (
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-400">
                              غیرفعال
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400" dir="ltr">{s.mobile}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-3.5 text-slate-600">{s.city ?? "—"}</td>
                  <td className="p-3.5"><FieldBadge field={s.course ?? s.field ?? undefined} /></td>
                  <td className="p-3.5 text-slate-600">{s.grade ?? "—"}</td>
                  <td className="p-3.5 text-slate-500">{s.goal ?? "—"}</td>
                  <td className="p-3.5 text-center text-slate-600">
                    {s.gpa != null ? faNum(s.gpa) : <span className="text-rose-400" title="معدل ثبت نشده">—</span>}
                  </td>
                  <td className="p-3.5"><SourceBadge source={s.lead_source} /></td>
                  <td className="p-3.5 text-center"><ScoreBadge score={s.lead_score} /></td>
                  <td className="p-3.5"><StageBadge stage={s.stage} /></td>
                  <td className="p-3.5 text-center">
                    <span
                      className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600"
                      title={`${s.call_count ?? 0} بار تماس گرفته شده`}
                    >
                      <Phone size={12} /> {s.call_count ?? 0}
                    </span>
                  </td>
                  <td className="p-3.5">
                    <div className="flex items-center justify-center gap-2">
                      <CallButton mobile={s.mobile} size="sm" />
                      <ContactLinks mobile={s.mobile} />
                      <button
                        onClick={() => setMsgStudent(s)}
                        title="ارسال پیام"
                        className="inline-flex items-center justify-center rounded-lg bg-violet-50 p-1.5 text-violet-600 transition hover:bg-violet-100"
                      >
                        <MessageSquare size={16} />
                      </button>
                      <button
                        onClick={() => setEditStudent(s)}
                        title="ویرایش / تکمیل اطلاعات"
                        className="inline-flex items-center justify-center rounded-lg bg-blue-50 p-1.5 text-blue-600 transition hover:bg-blue-100"
                      >
                        <Pencil size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* حالت خالی */}
          {items.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-slate-400">
              <GraduationCap size={40} className="opacity-40" />
              <p className="text-sm">دانشجویی مطابق جستجوی شما یافت نشد.</p>
            </div>
          )}
        </div>

        {msgStudent && (
          <MessageModal student={msgStudent} onClose={() => setMsgStudent(null)} />
        )}
        {editStudent && (
          <EditStudentModal student={editStudent} onClose={() => setEditStudent(null)} />
        )}
      </main>
    </div>
  );
}

/* ---------- مودال ویرایش/تکمیل اطلاعات دانشجو ---------- */
function EditStudentModal({ student, onClose }: { student: Student; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [fullName, setFullName] = useState(student.full_name ?? "");
  const [city, setCity] = useState(student.city ?? "");
  const [fld, setFld] = useState(student.field ?? student.course ?? "");
  const [grade, setGrade] = useState(student.grade ?? "");
  const [goal, setGoal] = useState(student.goal ?? "");
  const [gpa, setGpa] = useState(student.gpa != null ? String(student.gpa) : "");
  const [source, setSource] = useState(student.lead_source ?? "");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    setLoading(true);
    try {
      if (DEMO) {
        setMsg("در حالت نمایشی ذخیره نمی‌شود.");
        setLoading(false);
        return;
      }
      await api.patch(`/students/${student.id}`, {
        full_name: fullName || null,
        city: city || null,
        field: fld || null,
        grade: grade || null,
        goal: goal || null,
        gpa: gpa ? Number(gpa) : null,
        lead_source: source || null,
      });
      qc.invalidateQueries({ queryKey: ["students"] });
      qc.invalidateQueries({ queryKey: ["students-incomplete"] });
      toast("اطلاعات ذخیره شد ✓");
      onClose();
    } catch {
      setMsg("ذخیره ناموفق بود.");
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-bold text-slate-800">
            <Pencil size={18} className="text-blue-600" /> ویرایش / تکمیل اطلاعات
          </h2>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <p className="mb-4 text-sm text-slate-500" dir="ltr">{student.mobile}</p>
        <form onSubmit={submit} className="space-y-3">
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="نام و نام خانوادگی"
            className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-blue-400" />
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
          <input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="هدف (مثلاً پزشکی دانشگاه تهران)"
            className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-blue-400" />
          <div className="grid grid-cols-2 gap-3">
            <input value={gpa} onChange={(e) => setGpa(e.target.value)} type="number" placeholder="معدل" min={0} max={20} step="0.01"
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-blue-400" dir="ltr" />
            <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="شهر"
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-blue-400" />
          </div>
          <select value={source} onChange={(e) => setSource(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-400">
            <option value="">منبع تماس…</option>
            {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <div className="flex items-center justify-end gap-2 pt-1">
            {msg && <span className="mr-auto text-xs text-slate-500">{msg}</span>}
            <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">انصراف</button>
            <button disabled={loading} className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60">
              {loading && <Loader2 size={15} className="animate-spin" />} ذخیره
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ---------- مودال ارسال پیام (پیامک/واتساپ/تلگرام، متن آزاد) ---------- */
function MessageModal({ student, onClose }: { student: Student; onClose: () => void }) {
  const [channel, setChannel] = useState("sms");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) {
      setMsg("متن پیام را بنویسید.");
      return;
    }
    setMsg("");
    setLoading(true);
    try {
      // ثبت پیام در سرور (در دمو ذخیره نمی‌شود)
      if (!DEMO) {
        await api.post("/messages", {
          mobile: student.mobile, channel, body: text,
          student_id: student.id,
        });
      }
      // واتساپ/تلگرام: باز کردن پیام‌رسان با متن آماده
      const intl = toIntl(student.mobile);
      if (channel === "whatsapp") {
        window.open(`https://wa.me/${intl}?text=${encodeURIComponent(text)}`, "_blank");
      } else if (channel === "telegram") {
        window.open(`https://t.me/share/url?url=&text=${encodeURIComponent(text)}`, "_blank");
      }
      setMsg(DEMO ? "در حالت نمایشی ثبت نشد (پیام‌رسان باز شد)." : "پیام ثبت شد ✓");
      if (!DEMO && channel === "sms") onClose();
    } catch {
      setMsg("ارسال ناموفق بود.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-bold text-slate-800">
            <MessageSquare size={18} className="text-violet-600" /> ارسال پیام
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={18} />
          </button>
        </div>

        <p className="mb-4 text-sm text-slate-500">
          {student.full_name ?? "ناشناس"} · <span dir="ltr">{student.mobile}</span>
        </p>

        <form onSubmit={submit} className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {MSG_CHANNELS.map((c) => (
              <button
                key={c.v}
                type="button"
                onClick={() => setChannel(c.v)}
                className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                  channel === c.v
                    ? "bg-violet-500 text-white shadow-sm shadow-violet-200"
                    : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            placeholder="متن پیام را آزادانه بنویسید…"
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-violet-400"
          />

          <div className="flex items-center justify-end gap-2">
            {msg && <span className="mr-auto text-xs text-slate-500">{msg}</span>}
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
            >
              بستن
            </button>
            <button
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-700 disabled:opacity-60"
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              {channel === "sms" ? "ارسال پیامک" : "باز کردن و ثبت"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
