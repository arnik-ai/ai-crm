"use client";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { isDemoMode } from "@/lib/auth";
import { Sidebar } from "@/components/Sidebar";
import { CallButton } from "@/components/CallButton";
import { BackButton } from "@/components/BackButton";
import { ExportButton } from "@/components/ExportButton";
import { ExportAllButton } from "@/components/ExportAllButton";
import type { ExcelColumn } from "@/lib/exportExcel";
import { faDuration, faDateTime } from "@/lib/utils";
import { JalaliDatePicker } from "@/components/JalaliDatePicker";
import {
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Phone,
  Play,
  Search,
  Sparkles,
  Pencil,
  ShieldCheck,
  TriangleAlert,
  ClipboardCheck,
  X,
  Loader2,
} from "lucide-react";

const DEMO = isDemoMode();

/** گزینه‌های نتیجه‌ی تماس (مطابق وضعیت‌های فروش). */
const OUTCOMES = [
  { v: "successful", label: "موفق" },
  { v: "unsuccessful", label: "ناموفق" },
  { v: "busy", label: "مشغول/مشترک" },
  { v: "no_answer", label: "پاسخ نداد" },
  { v: "follow_up", label: "پیگیری" },
];

type Call = {
  id: string;
  direction: "inbound" | "outbound";
  status?: string;
  // نتیجه‌ی تماس از نظر فروش (دستیِ کارشناس):
  // successful / unsuccessful / busy / no_answer / follow_up
  outcome?: string | null;
  student_name?: string;
  caller_number: string;
  duration_sec: number;
  started_at?: string;
  lead_score?: number;
  summary?: string;
  signals?: string[];
  confidence?: number;
};

/** نشان رنگیِ وضعیت/نتیجه‌ی تماس (مطابق ستون رنگی عکس ۶ کارفرما). */
function StatusBadge({ status, outcome }: { status?: string; outcome?: string | null }) {
  // اولویت با وضعیت فنی «بی‌پاسخ»؛ سپس نتیجه‌ی دستی کارشناس.
  const map: Record<string, { label: string; cls: string }> = {
    missed: { label: "بی‌پاسخ", cls: "bg-rose-100 text-rose-700 ring-rose-200" },
    successful: { label: "موفق", cls: "bg-emerald-100 text-emerald-700 ring-emerald-200" },
    unsuccessful: { label: "ناموفق", cls: "bg-rose-100 text-rose-700 ring-rose-200" },
    busy: { label: "مشغول/مشترک", cls: "bg-amber-100 text-amber-700 ring-amber-200" },
    no_answer: { label: "پاسخ نداد", cls: "bg-slate-100 text-slate-600 ring-slate-200" },
    follow_up: { label: "پیگیری", cls: "bg-blue-100 text-blue-700 ring-blue-200" },
  };
  const key = status === "missed" ? "missed" : outcome ?? "";
  const v = map[key];
  if (!v)
    return (
      <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500 ring-1 ring-slate-200">
        اقدام نشده
      </span>
    );
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ${v.cls}`}>
      {v.label}
    </span>
  );
}

/** نشان جهت + وضعیت تماس. */
function DirectionTag({ direction, status }: { direction: string; status?: string }) {
  if (status === "missed")
    return (
      <span className="inline-flex items-center gap-1.5 text-rose-600">
        <PhoneMissed size={16} /> بی‌پاسخ
      </span>
    );
  if (direction === "inbound")
    return (
      <span className="inline-flex items-center gap-1.5 text-blue-600">
        <PhoneIncoming size={16} /> ورودی
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 text-emerald-600">
      <PhoneOutgoing size={16} /> خروجی
    </span>
  );
}

function ScoreBadge({ score }: { score?: number }) {
  if (score == null) return <span className="text-slate-300">—</span>;
  const tone =
    score >= 70 ? "bg-emerald-50 text-emerald-700"
    : score >= 40 ? "bg-amber-50 text-amber-700"
    : "bg-blue-50 text-blue-700";
  return (
    <span className={`inline-flex min-w-[2.5rem] justify-center rounded-full px-2 py-0.5 text-xs font-bold ${tone}`}>
      {score}
    </span>
  );
}

/** نشان اطمینان هوش مصنوعی به استخراج: بالا (سبز) / متوسط (زرد) / پایین = نیاز به بازبینی (قرمز). */
function ConfidenceBadge({ value }: { value?: number }) {
  if (value == null) return null;
  const pct = Math.round(value * 100);
  if (value >= 0.75)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
        <ShieldCheck size={13} /> اطمینان {pct}٪
      </span>
    );
  if (value >= 0.5)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
        <ShieldCheck size={13} /> اطمینان {pct}٪
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700">
      <TriangleAlert size={13} /> نیاز به بازبینی ({pct}٪)
    </span>
  );
}

const FILTERS = [
  { key: "all", label: "همه" },
  { key: "inbound", label: "ورودی" },
  { key: "outbound", label: "خروجی" },
  { key: "missed", label: "بی‌پاسخ" },
];

/** متن خوانای وضعیت/نتیجه‌ی تماس برای نمایش و خروجی اکسل. */
function statusLabel(c: Call): string {
  if (c.status === "missed") return "بی‌پاسخ";
  const map: Record<string, string> = {
    successful: "موفق",
    unsuccessful: "ناموفق",
    busy: "مشغول/مشترک",
    no_answer: "پاسخ نداد",
    follow_up: "پیگیری",
  };
  return c.outcome ? map[c.outcome] ?? c.outcome : "اقدام نشده";
}

/** متن جهت تماس برای خروجی اکسل. */
function directionLabel(c: Call): string {
  if (c.status === "missed") return "بی‌پاسخ";
  return c.direction === "inbound" ? "ورودی" : "خروجی";
}

// ستون‌های خروجی اکسل تماس‌ها
const EXCEL_COLUMNS: ExcelColumn<Call>[] = [
  { key: "student_name", label: "نام", format: (c) => c.student_name ?? "ناشناس" },
  { key: "caller_number", label: "شماره" },
  { key: "direction", label: "جهت", format: directionLabel },
  { key: "status", label: "وضعیت تماس", format: statusLabel },
  { key: "duration_sec", label: "مدت (ثانیه)", format: (c) => c.duration_sec ?? 0 },
  { key: "started_at", label: "تاریخ/زمان", format: (c) => faDateTime(c.started_at) },
  { key: "lead_score", label: "امتیاز", format: (c) => c.lead_score ?? "" },
  { key: "summary", label: "خلاصه هوش مصنوعی", format: (c) => c.summary ?? "" },
];

export default function CallsPage() {
  const { data } = useQuery({
    queryKey: ["calls"],
    queryFn: async () => (await api.get("/calls")).data,
  });
  const all: Call[] = data?.items ?? [];

  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  // تماسی که مودال «ثبت نتیجه» برایش باز است (null = بسته)
  const [outcomeCall, setOutcomeCall] = useState<Call | null>(null);

  // شمارش برای کارت‌های آماری
  const counts = useMemo(() => ({
    inbound: all.filter((c) => c.direction === "inbound" && c.status !== "missed").length,
    outbound: all.filter((c) => c.direction === "outbound").length,
    missed: all.filter((c) => c.status === "missed").length,
  }), [all]);

  const items = useMemo(() => {
    let list = all;
    if (filter === "missed") list = list.filter((c) => c.status === "missed");
    else if (filter !== "all")
      list = list.filter((c) => c.direction === filter && c.status !== "missed");
    if (q.trim()) {
      const k = q.trim();
      list = list.filter(
        (c) => (c.student_name ?? "").includes(k) || c.caller_number.includes(k)
      );
    }
    return list;
  }, [all, q, filter]);

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar />
      <main className="flex-1 p-4 md:p-8">
        {/* سرتیتر */}
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-md shadow-emerald-200">
              <Phone size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-white">تماس‌ها</h1>
              <p className="mt-0.5 text-sm text-slate-300">
                {all.length} تماس · همراه تحلیل هوش مصنوعی هر مکالمه
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ExportButton rows={items} columns={EXCEL_COLUMNS} filename="تماس‌ها" />
            <ExportAllButton endpoint="/calls/export" filename="همه-تماس‌ها" />
            <BackButton dark />
          </div>
        </div>

        {/* کارت‌های آماری */}
        <div className="mb-5 grid grid-cols-3 gap-3">
          <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-sky-50 to-blue-50 p-4">
            <div className="flex items-center gap-2 text-blue-600"><PhoneIncoming size={18} /> ورودی</div>
            <div className="mt-1 text-2xl font-extrabold text-blue-700">{counts.inbound}</div>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-teal-50 p-4">
            <div className="flex items-center gap-2 text-emerald-600"><PhoneOutgoing size={18} /> خروجی</div>
            <div className="mt-1 text-2xl font-extrabold text-emerald-700">{counts.outbound}</div>
          </div>
          <div className="rounded-2xl border border-rose-100 bg-gradient-to-br from-rose-50 to-pink-50 p-4">
            <div className="flex items-center gap-2 text-rose-600"><PhoneMissed size={18} /> بی‌پاسخ</div>
            <div className="mt-1 text-2xl font-extrabold text-rose-700">{counts.missed}</div>
          </div>
        </div>

        {/* جستجو و فیلتر */}
        <div className="panel-toolbar mb-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 sm:max-w-xs">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="جستجوی نام یا شماره…"
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-9 pl-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
          </div>
          <div className="flex gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                  filter === f.key
                    ? "bg-emerald-500 text-white shadow-sm shadow-emerald-200"
                    : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {items.map((c) => (
            <div
              key={c.id}
              className="rounded-2xl border border-slate-100 bg-gradient-to-br from-white to-slate-50/60 p-4 shadow-sm transition hover:shadow-md"
            >
              {/* ردیف بالا: نام، جهت، زمان، امتیاز، اقدام */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 font-bold text-slate-600">
                  {(c.student_name ?? "?").charAt(0)}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-slate-800">
                    {c.student_name ?? "ناشناس"}
                  </div>
                  <div className="text-xs text-slate-400" dir="ltr">{c.caller_number}</div>
                </div>

                <div className="mr-auto flex flex-wrap items-center gap-4 text-sm">
                  <DirectionTag direction={c.direction} status={c.status} />
                  <StatusBadge status={c.status} outcome={c.outcome} />
                  <span className="text-slate-500">{faDuration(c.duration_sec)}</span>
                  <span className="text-slate-400">{faDateTime(c.started_at)}</span>
                  <ScoreBadge score={c.lead_score} />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setOutcomeCall(c)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                    title="ثبت نتیجه‌ی تماس و تعیین تماس بعدی"
                  >
                    <ClipboardCheck size={14} /> ثبت نتیجه
                  </button>
                  {c.status !== "missed" && (
                    <button
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                      title="پخش فایل صوتی"
                    >
                      <Play size={14} /> پخش
                    </button>
                  )}
                  <CallButton mobile={c.caller_number} size="sm" />
                </div>
              </div>

              {/* خلاصه‌ی هوش مصنوعی */}
              {c.summary && (
                <div className="mt-3 rounded-xl bg-gradient-to-l from-violet-50 to-blue-50 p-3">
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-violet-700">
                      <Sparkles size={14} /> خلاصه‌ی هوش مصنوعی
                    </span>
                    <ConfidenceBadge value={c.confidence} />
                    <button
                      className="mr-auto inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-white/70 px-2 py-1 text-xs font-medium text-violet-700 transition hover:bg-white"
                      title="ویرایش اطلاعات استخراج‌شده"
                    >
                      <Pencil size={12} /> ویرایش
                    </button>
                  </div>
                  <p className="text-sm leading-relaxed text-slate-700">{c.summary}</p>
                  {c.signals && c.signals.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {c.signals.map((sig, i) => (
                        <span
                          key={i}
                          className="rounded-full bg-white/70 px-2 py-0.5 text-xs text-violet-700 ring-1 ring-violet-100"
                        >
                          {sig}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* حالت خالی */}
          {items.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-slate-100 bg-white py-16 text-slate-400">
              <Phone size={40} className="opacity-40" />
              <p className="text-sm">تماسی مطابق جستجوی شما یافت نشد.</p>
            </div>
          )}
        </div>

        {outcomeCall && (
          <OutcomeModal call={outcomeCall} onClose={() => setOutcomeCall(null)} />
        )}
      </main>
    </div>
  );
}

/* ---------- مودال ثبت نتیجه‌ی تماس + تعیین تماس بعدی ---------- */
function OutcomeModal({ call, onClose }: { call: Call; onClose: () => void }) {
  const qc = useQueryClient();
  const [outcome, setOutcome] = useState(call.outcome ?? "");
  const [nextDate, setNextDate] = useState(""); // ISO میلادی از پیکر شمسی
  const [nextTime, setNextTime] = useState(""); // HH:MM
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!outcome && !nextDate) {
      setMsg("حداقل نتیجه یا تاریخ تماس بعدی را وارد کنید.");
      return;
    }
    setMsg("");
    setLoading(true);
    try {
      if (DEMO) {
        setMsg("در حالت نمایشی ذخیره نمی‌شود.");
        return;
      }
      // تاریخِ شمسی (ISO میلادی) + ساعت → datetime؛ اگر ساعت نبود ۹ صبح فرض می‌شود
      const nextCallAt = nextDate
        ? new Date(`${nextDate}T${nextTime || "09:00"}`).toISOString()
        : null;
      await api.post(`/calls/${call.id}/outcome`, {
        outcome: outcome || null,
        next_call_at: nextCallAt,
        note: note || null,
      });
      qc.invalidateQueries({ queryKey: ["calls"] });
      qc.invalidateQueries({ queryKey: ["tasks-today"] });
      onClose();
    } catch {
      setMsg("ثبت ناموفق بود.");
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
            <ClipboardCheck size={18} className="text-emerald-600" />
            ثبت نتیجه‌ی تماس
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={18} />
          </button>
        </div>

        <p className="mb-4 text-sm text-slate-500">
          {call.student_name ?? "ناشناس"} ·{" "}
          <span dir="ltr">{call.caller_number}</span>
        </p>

        <form onSubmit={submit} className="space-y-4">
          {/* نتیجه‌ی تماس */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              نتیجه‌ی تماس
            </label>
            <div className="flex flex-wrap gap-2">
              {OUTCOMES.map((o) => (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => setOutcome(o.v === outcome ? "" : o.v)}
                  className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                    outcome === o.v
                      ? "bg-emerald-500 text-white shadow-sm shadow-emerald-200"
                      : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* تاریخ تماس بعدی */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              تاریخ و ساعت تماس بعدی{" "}
              <span className="font-normal text-slate-400">(اختیاری)</span>
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <JalaliDatePicker
                value={nextDate}
                onChange={setNextDate}
                placeholder="تاریخ (شمسی)"
              />
              <input
                type="time"
                value={nextTime}
                onChange={(e) => setNextTime(e.target.value)}
                className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-emerald-400"
                dir="ltr"
              />
            </div>
            <p className="mt-1 text-xs text-slate-400">
              اگر تاریخ تعیین شود، یک پیگیری در «کارهای روز» ساخته می‌شود
              (ساعت پیش‌فرض ۹ صبح).
            </p>
          </div>

          {/* توضیح */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              توضیح{" "}
              <span className="font-normal text-slate-400">(اختیاری)</span>
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="مثلاً: درخواست اطلاعات بیشتر داشت…"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-400"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            {msg && <span className="mr-auto text-xs text-slate-500">{msg}</span>}
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
            >
              انصراف
            </button>
            <button
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
            >
              {loading && <Loader2 size={15} className="animate-spin" />} ثبت نتیجه
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
