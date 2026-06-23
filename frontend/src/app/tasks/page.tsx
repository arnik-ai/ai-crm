"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Sidebar } from "@/components/Sidebar";
import { CallButton } from "@/components/CallButton";
import { isDemoMode } from "@/lib/auth";
import { faNum, faDateTime } from "@/lib/utils";
import {
  ClipboardList, CalendarClock, PhoneMissed, PhoneOff, UserPlus, Loader2, Plus,
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

type TasksResponse = {
  followups: TaskItem[];
  pending_action_calls: TaskItem[];
  missed_calls: TaskItem[];
};

export default function TasksPage() {
  const { data } = useQuery<TasksResponse>({
    queryKey: ["tasks-today"],
    queryFn: async () => (await api.get("/dashboard/tasks")).data,
  });

  const followups = data?.followups ?? [];
  const pending = data?.pending_action_calls ?? [];
  const missed = data?.missed_calls ?? [];
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

        {/* باکس شماره‌های جدید */}
        <NewNumberBox />

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
