"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Sidebar } from "@/components/Sidebar";
import { CallButton } from "@/components/CallButton";
import { isDemoMode } from "@/lib/auth";
import { faNum, faDateTime } from "@/lib/utils";
import {
  ClipboardList, CalendarClock, PhoneMissed, PhoneOff, UserPlus, Loader2, Plus,
  AlertTriangle, PhoneForwarded,
} from "lucide-react";

const DEMO = isDemoMode();

type TaskItem = {
  id: string;
  student_name: string | null;
  mobile: string | null;
  due_at?: string | null;
  started_at?: string | null;
  note?: string | null;
};

type RenewalItem = {
  id: string;
  student_name: string | null;
  mobile: string | null;
  renewal_due_at: string | null;
  program_months?: number | null;
};

type TasksResponse = {
  followups: TaskItem[];
  pending_action_calls: TaskItem[];
  missed_calls: TaskItem[];
  renewal_reminders?: RenewalItem[];
};

/** تعداد روز مانده تا یک تاریخ (منفی = گذشته). */
function daysUntil(iso?: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.ceil(ms / 86_400_000);
}

export default function TasksPage() {
  const { data } = useQuery<TasksResponse>({
    queryKey: ["tasks-today"],
    queryFn: async () => (await api.get("/dashboard/tasks")).data,
  });
  // یادآور تماس بعدیِ تعیین‌نشده — هر ۵.۵ دقیقه تازه می‌شود
  const { data: nag, dataUpdatedAt: nagAt } = useQuery<{ items: { id: string; student_name: string | null; mobile: string | null }[] }>({
    queryKey: ["missing-next-call"],
    queryFn: async () => (await api.get("/dashboard/missing-next-call")).data,
    refetchInterval: 330_000,
  });

  const followups = data?.followups ?? [];
  const pending = data?.pending_action_calls ?? [];
  const missed = data?.missed_calls ?? [];
  const renewals = data?.renewal_reminders ?? [];
  const totalTasks = followups.length + pending.length;

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar />
      <main className="flex-1 p-4 md:p-8">
        {/* سرتیتر */}
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-200">
            <ClipboardList size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-white">کارهای روز من</h1>
            <p className="mt-0.5 text-sm text-slate-300">
              {faNum(totalTasks)} کار باز · {faNum(missed.length)} بی‌پاسخ
            </p>
          </div>
        </div>

        {/* یادآور تماس بعدیِ تعیین‌نشده (با هر بار تازه‌سازی دوباره ظاهر می‌شود) */}
        <NextCallNag key={nagAt} items={nag?.items ?? []} />

        {/* باکس شماره‌های جدید */}
        <NewNumberBox />

        {/* یادآور تمدید برنامه */}
        <RenewalReminders items={renewals} />

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {/* پیگیری‌های امروز */}
          <Section
            title="پیگیری‌های امروز"
            icon={<CalendarClock size={18} className="text-blue-500" />}
            count={followups.length}
            tone="border-blue-100"
            empty="پیگیری‌ای برای امروز نداری."
            items={followups}
            timeField="due_at"
            showNote
          />
          {/* تماس‌های بدون اقدام */}
          <Section
            title="تماس‌های بدون اقدام"
            icon={<PhoneOff size={18} className="text-amber-500" />}
            count={pending.length}
            tone="border-amber-100"
            empty="همه‌ی تماس‌ها اقدام شده‌اند. 👌"
            items={pending}
            timeField="started_at"
            hint="نتیجه‌ی این تماس‌ها هنوز ثبت نشده"
          />
          {/* بی‌پاسخ‌ها */}
          <Section
            title="تماس‌های بی‌پاسخ"
            icon={<PhoneMissed size={18} className="text-rose-500" />}
            count={missed.length}
            tone="border-rose-100"
            empty="بی‌پاسخی نداری."
            items={missed}
            timeField="started_at"
          />
        </div>
      </main>
    </div>
  );
}

function Section({
  title, icon, count, tone, empty, items, timeField, showNote, hint,
}: {
  title: string; icon: React.ReactNode; count: number; tone: string;
  empty: string; items: TaskItem[]; timeField: "due_at" | "started_at";
  showNote?: boolean; hint?: string;
}) {
  return (
    <div className={`rounded-2xl border bg-white p-4 shadow-sm ${tone}`}>
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <h2 className="font-bold text-slate-800">{title}</h2>
        <span className="mr-auto rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">
          {faNum(count)}
        </span>
      </div>
      {hint && <p className="mb-2 text-xs text-slate-400">{hint}</p>}
      <div className="space-y-2">
        {items.map((t) => (
          <div key={t.id} className="flex items-center gap-2 rounded-xl bg-slate-50 p-2.5">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-slate-700">
                {t.student_name || "ناشناس"}
              </div>
              <div className="text-xs text-slate-400" dir="ltr">{t.mobile || "—"}</div>
              {showNote && t.note && (
                <div className="mt-0.5 truncate text-xs text-slate-500">{t.note}</div>
              )}
              <div className="text-[11px] text-slate-400">{faDateTime(t[timeField] ?? undefined)}</div>
            </div>
            {t.mobile && <CallButton mobile={t.mobile} size="sm" />}
          </div>
        ))}
        {items.length === 0 && (
          <p className="py-6 text-center text-xs text-slate-400">{empty}</p>
        )}
      </div>
    </div>
  );
}

/* ---------- یادآور تماس بعدیِ تعیین‌نشده ---------- */
function NextCallNag({
  items,
}: {
  items: { id: string; student_name: string | null; mobile: string | null }[];
}) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed || items.length === 0) return null;
  return (
    <div className="mb-1 rounded-2xl border border-rose-200 bg-rose-50 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <PhoneForwarded size={18} className="text-rose-500" />
          <h2 className="font-bold text-rose-700">تماس بعدی را تعیین نکرده‌ای</h2>
          <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700">
            {faNum(items.length)}
          </span>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-xs text-rose-400 transition hover:text-rose-600"
        >
          بستن
        </button>
      </div>
      <div className="mt-2 space-y-1.5">
        {items.map((n) => (
          <div key={n.id} className="flex items-center justify-between gap-2 rounded-lg bg-white/70 p-2 text-sm">
            <span className="text-slate-700">
              ☎️ برای <b>{n.student_name || n.mobile}</b> تایم تماس بعدی رو تعیین نکردی
            </span>
            <Link
              href="/calls"
              className="shrink-0 rounded-lg bg-rose-500 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-rose-600"
            >
              ثبت نتیجه
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- یادآور تمدید برنامه ---------- */
function RenewalReminders({ items }: { items: RenewalItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-4 rounded-2xl border border-amber-200 bg-gradient-to-l from-amber-50 to-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <AlertTriangle size={18} className="text-amber-500" />
        <h2 className="font-bold text-slate-800">یادآور تمدید برنامه</h2>
        <span className="mr-auto rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
          {faNum(items.length)}
        </span>
      </div>
      <div className="space-y-2">
        {items.map((r) => {
          const d = daysUntil(r.renewal_due_at);
          const text =
            d == null ? "موعد تمدید"
            : d <= 0 ? `موعد تمدید برنامه ${r.student_name ?? ""} رسیده`
            : `${faNum(d)} روز تا موعد تمدید برنامه ${r.student_name ?? ""}`;
          const urgent = d != null && d <= 2;
          return (
            <div
              key={r.id}
              className={`flex items-center gap-2 rounded-xl p-2.5 ${
                urgent ? "bg-rose-50" : "bg-amber-50/60"
              }`}
            >
              <span className="text-base">⚠️</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-slate-700">{text}</div>
                <div className="text-[11px] text-slate-400">
                  روز تمدید: {faDateTime(r.renewal_due_at ?? undefined)}
                  {r.program_months ? ` · برنامه ${faNum(r.program_months)} ماهه` : ""}
                </div>
              </div>
              {r.mobile && <CallButton mobile={r.mobile} size="sm" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- باکس افزودن شماره‌ی جدید ---------- */
function NewNumberBox() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  const [source, setSource] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(""); setLoading(true);
    try {
      if (DEMO) {
        setMsg("در حالت نمایشی ذخیره نمی‌شود.");
        return;
      }
      await api.post("/students", {
        full_name: fullName || null, mobile, lead_source: source || null,
      });
      setFullName(""); setMobile(""); setSource("");
      setMsg("شماره ثبت شد ✓");
      qc.invalidateQueries({ queryKey: ["students"] });
    } catch {
      setMsg("ثبت ناموفق بود (شاید تکراری است).");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-emerald-100 bg-gradient-to-l from-emerald-50/60 to-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <UserPlus size={18} className="text-emerald-600" />
          <h2 className="font-bold text-slate-800">اقدامات جدید — ثبت شماره‌ی جدید</h2>
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-700"
        >
          <Plus size={15} /> {open ? "بستن" : "شماره‌ی جدید"}
        </button>
      </div>

      {open && (
        <form onSubmit={submit} className="mt-3 flex flex-wrap items-center gap-2">
          <input
            placeholder="نام (اختیاری)"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-400"
          />
          <input
            type="tel"
            placeholder="موبایل"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-400"
            dir="ltr"
            required
          />
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-400"
          >
            <option value="">منبع…</option>
            <option value="اینستاگرام">اینستاگرام</option>
            <option value="تلگرام">تلگرام</option>
            <option value="سایت">سایت</option>
            <option value="روبیکا">روبیکا</option>
            <option value="بله">بله</option>
            <option value="پیامک">پیامک</option>
          </select>
          <button
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
          >
            {loading && <Loader2 size={15} className="animate-spin" />} ثبت
          </button>
          {msg && <span className="text-xs text-slate-500">{msg}</span>}
        </form>
      )}
    </div>
  );
}
