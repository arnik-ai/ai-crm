"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiErrorMessage } from "@/lib/api";
import { Sidebar } from "@/components/Sidebar";
import { CallButton } from "@/components/CallButton";
import { isDemoMode } from "@/lib/auth";
import { faNum, faDateTime, faDate } from "@/lib/utils";
import { useToast } from "@/components/Toast";
import { JalaliDatePicker } from "@/components/JalaliDatePicker";
import { MessageModal } from "@/components/MessageModal";
// (faDate برای نمایشِ تاریخِ ثبتِ شماره‌ی تکراری)
import {
  ClipboardList, CalendarClock, PhoneMissed, PhoneOff, UserPlus, Loader2, Plus,
  AlertTriangle, PhoneForwarded, Pencil, ClipboardCheck, X, Users, Trash2, MessageSquare,
  Phone, MoreHorizontal, MessageCircle, Send, ChevronDown,
} from "lucide-react";

/** شماره به ارقام بین‌المللی بدون + (۰ ابتدایی → ۹۸) — برای لینکِ واتساپ/تلگرام. */
function toIntl(mobile: string): string {
  let d = mobile.replace(/\D/g, "");
  if (d.startsWith("0")) d = "98" + d.slice(1);
  return d;
}

const DEMO = isDemoMode();

type TaskItem = {
  id: string;
  student_id?: string | null;   // برای بازکردنِ مودالِ ثبتِ نتیجه (پیگیری‌ها)
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
  // مودالِ ثبتِ نتیجه از روی «پیگیری‌های امروز» (کلیک روی اسم)
  const [fuResult, setFuResult] = useState<Lead | null>(null);

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

        {/* آلارم اطلاعات ناقص — یادآوری برای تکمیل */}
        <IncompleteNag />

        {/* باکس شماره‌های جدید */}
        <NewNumberBox />

        {/* سرنخ‌های امروز — کارت‌به‌کارت با تماس و ثبتِ نتیجه */}
        <TodayLeads />

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
            onItemClick={(t) =>
              t.student_id && setFuResult({
                id: t.student_id, full_name: t.student_name, mobile: t.mobile ?? "",
              })
            }
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

        {/* ثبتِ نتیجه از روی «پیگیری‌های امروز» */}
        {fuResult && (
          <LeadResultModal lead={fuResult} onClose={() => setFuResult(null)} />
        )}
      </main>
    </div>
  );
}

function Section({
  title, icon, count, tone, empty, items, timeField, showNote, hint, onItemClick,
}: {
  title: string; icon: React.ReactNode; count: number; tone: string;
  empty: string; items: TaskItem[]; timeField: "due_at" | "started_at";
  showNote?: boolean; hint?: string;
  onItemClick?: (t: TaskItem) => void;
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
        {items.map((t) => {
          const clickable = !!(onItemClick && t.student_id);
          return (
            <div
              key={t.id}
              onClick={clickable ? () => onItemClick!(t) : undefined}
              className={`flex items-center gap-3 rounded-2xl border bg-white p-3 shadow-sm transition ${
                clickable
                  ? "cursor-pointer border-slate-200 hover:-translate-y-0.5 hover:border-blue-300 hover:bg-blue-50/40 hover:shadow-md"
                  : "border-slate-100"
              }`}
            >
              {/* آواتارِ رنگی با حرف اول نام */}
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 text-sm font-bold text-indigo-600 ring-1 ring-indigo-50">
                {(t.student_name ?? "?").trim().charAt(0) || "?"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-semibold text-slate-800">
                    {t.student_name || "ناشناس"}
                  </span>
                  {clickable && (
                    <span className="shrink-0 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">
                      ثبت نتیجه
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-400" dir="ltr">{t.mobile || "—"}</div>
                {showNote && t.note && (
                  <div className="mt-1 flex items-start gap-1 rounded-lg bg-slate-50 px-2 py-1 text-xs text-slate-500">
                    <span>📝</span><span className="truncate">{t.note}</span>
                  </div>
                )}
                <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-slate-400">
                  <CalendarClock size={11} /> {faDateTime(t[timeField] ?? undefined)}
                </div>
              </div>
              {t.mobile && (
                <div onClick={(e) => e.stopPropagation()}>
                  <CallButton mobile={t.mobile} size="sm" />
                </div>
              )}
            </div>
          );
        })}
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
  // جمع‌شونده: پیش‌فرض بسته (فقط تیتر + عدد).
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  if (items.length === 0) return null;
  const shown = showAll ? items : items.slice(0, 3);
  return (
    <div className="mt-4 rounded-2xl border border-amber-200 bg-gradient-to-l from-amber-50 to-white p-4 shadow-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 text-right"
      >
        <AlertTriangle size={18} className="shrink-0 text-amber-500" />
        <h2 className="font-bold text-slate-800">یادآور تمدید برنامه</h2>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
          {faNum(items.length)}
        </span>
        <ChevronDown size={16} className={`mr-auto text-amber-500 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-3 space-y-2">
          {shown.map((r) => {
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
                    روز تمدید: {faDate(r.renewal_due_at ?? undefined)}
                    {r.program_months ? ` · برنامه ${faNum(r.program_months)} ماهه` : ""}
                  </div>
                </div>
                {r.mobile && <CallButton mobile={r.mobile} size="sm" />}
              </div>
            );
          })}
          {items.length > 3 && (
            <button
              onClick={() => setShowAll((v) => !v)}
              className="text-xs font-medium text-amber-600 hover:text-amber-700"
            >
              {showAll ? "بستن" : `نمایش همه (${faNum(items.length)})`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- آلارم اطلاعات ناقص (یادآوریِ تکمیل) ---------- */
type IncompleteItem = { id: string; full_name: string | null; mobile: string | null; missing: string[] };

function IncompleteNag() {
  const { data } = useQuery<{ items: IncompleteItem[]; count: number }>({
    queryKey: ["students-incomplete"],
    queryFn: async () => (await api.get("/students/incomplete")).data,
  });
  const items = data?.items ?? [];
  // جمع‌شونده: به‌صورتِ پیش‌فرض بسته (فقط تیتر + عدد) تا صفحه شلوغ نشود.
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  if (items.length === 0) return null;
  const shown = showAll ? items : items.slice(0, 3);
  return (
    <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex flex-1 items-center gap-2 text-right"
        >
          <AlertTriangle size={18} className="shrink-0 text-rose-500" />
          <h2 className="font-bold text-rose-700">اطلاعات ناقص — تکمیلش کن</h2>
          <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700">
            {faNum(items.length)}
          </span>
          <ChevronDown size={16} className={`text-rose-400 transition ${open ? "rotate-180" : ""}`} />
        </button>
        <Link
          href="/students"
          className="rounded-lg bg-rose-500 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-rose-600"
        >
          رفتن به تکمیل
        </Link>
      </div>
      {open && (
        <div className="mt-3 space-y-1.5">
          {shown.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-white/70 p-2 text-sm">
              <span className="font-medium text-slate-700">{s.full_name || s.mobile || "ناشناس"}</span>
              <span className="text-xs text-slate-400">کم دارد:</span>
              <span className="flex flex-wrap gap-1">
                {s.missing.map((m, i) => (
                  <span key={i} className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] text-rose-700">{m}</span>
                ))}
              </span>
            </div>
          ))}
          {items.length > 3 && (
            <button
              onClick={() => setShowAll((v) => !v)}
              className="text-xs font-medium text-rose-600 hover:text-rose-700"
            >
              {showAll ? "بستن" : `نمایش همه (${faNum(items.length)})`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- باکس افزودن شماره‌ی جدید ---------- */
function NewNumberBox() {
  const qc = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  const [source, setSource] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  // شماره‌ی تکراری: {نام، تاریخ ثبت}
  const [dup, setDup] = useState<{ student_name: string | null; created_at: string | null } | null>(null);
  // آخرین مقدارِ موبایلِ داخلِ فیلد — برای نادیده‌گرفتنِ پاسخِ کهنه‌ی lookup.
  // (⚠️ باگِ رفع‌شده: اگر بینِ ارسالِ lookup و رسیدنِ پاسخش، شماره ثبت/پاک شود،
  //  پاسخِ کهنه شماره را «تکراری» نشان می‌داد — همان شماره‌ای که تازه ساخته شد.)
  const mobileRef = useRef("");

  function setMobileSynced(v: string) {
    mobileRef.current = v;
    setMobile(v);
  }

  async function onMobileBlur() {
    setDup(null);
    const typed = mobile.trim();
    if (DEMO || typed.length < 8) return;
    try {
      const res = (await api.get(`/students/lookup?mobile=${encodeURIComponent(typed)}`)).data;
      // اگر در این فاصله شماره عوض/پاک شد (مثلاً ثبت انجام شد)، پاسخ را دور بریز.
      if (mobileRef.current.trim() !== typed) return;
      if (res.exists) {
        setDup({ student_name: res.student_name, created_at: res.created_at });
        if (res.student_name && !fullName.trim()) setFullName(res.student_name);
      }
    } catch { /* بی‌صدا */ }
  }

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
      // اول شماره را پاک کن (mobileRef هم خالی می‌شود) تا پاسخِ کهنه‌ی lookup بی‌اثر شود.
      setFullName(""); setMobileSynced(""); setSource(""); setDup(null);
      toast("شماره ثبت شد ✓");
      qc.invalidateQueries({ queryKey: ["students"] });
      qc.invalidateQueries({ queryKey: ["today-leads"] });
    } catch (err) {
      setMsg(apiErrorMessage(err, "ثبت ناموفق بود (شاید تکراری است)."));
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
            onChange={(e) => { setMobileSynced(e.target.value); setDup(null); }}
            onBlur={onMobileBlur}
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
          {/* هشدار شماره‌ی تکراری */}
          {dup && (
            <div className="w-full rounded-xl border border-amber-300 bg-amber-50 p-2.5 text-sm text-amber-800">
              ⚠️ این شماره <b>تکراری</b> است
              {dup.student_name ? ` — «${dup.student_name}»` : ""}
              {dup.created_at ? ` در تاریخ ${faDate(dup.created_at)} ثبت شده.` : " قبلاً ثبت شده."}
            </div>
          )}
        </form>
      )}
    </div>
  );
}

/* ---------- سرنخ‌های امروز (کارت‌به‌کارت با تماس و ثبتِ نتیجه) ---------- */
type Lead = {
  id: string;
  full_name: string | null;
  mobile: string;
  city?: string | null;
  field?: string | null;
  grade?: string | null;
  goal?: string | null;
  gpa?: number | null;
  lead_source?: string | null;
  status?: string;
  call_count?: number;
  created_at?: string;
  last_outcome?: string | null;      // نتیجه‌ی آخرین اقدام (موفق/بی‌پاسخ/…)
  last_outcome_at?: string | null;   // زمانِ ثبتِ نتیجه (برای علامتِ «اقدام‌شده»)
};

/** تُنِ رنگیِ برچسبِ نتیجه‌ی تماس (بر اساس برچسبِ فارسی). */
const OUTCOME_TONE: Record<string, string> = {
  "موفق": "bg-emerald-100 text-emerald-700",
  "خرید": "bg-green-100 text-green-700",
  "ناموفق": "bg-rose-100 text-rose-700",
  "مشغول/مشترک": "bg-amber-100 text-amber-700",
  "پاسخ نداد": "bg-slate-200 text-slate-600",
  "پیگیری": "bg-blue-100 text-blue-700",
};

type SaleMeta = { products: string[]; program_months: number[] };

const PROGRAM = "برنامه";
const OUTCOMES = [
  { v: "successful", label: "موفق" },
  { v: "purchased", label: "خرید" },
  { v: "unsuccessful", label: "ناموفق" },
  { v: "busy", label: "مشغول/مشترک" },
  { v: "no_answer", label: "پاسخ نداد" },
  { v: "follow_up", label: "پیگیری" },
];
const OUTCOME_LABEL: Record<string, string> =
  Object.fromEntries(OUTCOMES.map((o) => [o.v, o.label]));
const EDIT_FIELDS = ["تجربی", "ریاضی", "انسانی", "سایر"];
const EDIT_GRADES = ["دهم", "یازدهم", "دوازدهم", "فارغ‌التحصیل", "سایر"];
const EDIT_SOURCES = ["سایت", "اینستاگرام", "تلگرام", "روبیکا", "بله", "پیامک", "سایر"];

function TodayLeads() {
  const { data } = useQuery<{ items: Lead[] }>({
    queryKey: ["today-leads"],
    queryFn: async () => (await api.get("/students?today=true&size=50")).data,
  });
  const leads = data?.items ?? [];
  const [resultLead, setResultLead] = useState<Lead | null>(null);
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [msgLead, setMsgLead] = useState<Lead | null>(null);

  return (
    <div className="mt-4 rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <Users size={18} className="text-blue-500" />
        <h2 className="font-bold text-slate-800">سرنخ‌های امروز</h2>
        <span className="mr-auto rounded-full bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-600">
          {faNum(leads.length)}
        </span>
      </div>
      {leads.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">
          امروز شماره‌ای ثبت نکرده‌ای. از باکسِ بالا «شماره‌ی جدید» را بزن تا اینجا کارت شود.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {leads.map((l) => (
            <LeadCard
              key={l.id}
              lead={l}
              onResult={() => setResultLead(l)}
              onEdit={() => setEditLead(l)}
              onMsg={() => setMsgLead(l)}
            />
          ))}
        </div>
      )}
      {resultLead && <LeadResultModal lead={resultLead} onClose={() => setResultLead(null)} />}
      {editLead && <LeadEditModal lead={editLead} onClose={() => setEditLead(null)} />}
      {msgLead && (
        <MessageModal
          student={{ id: msgLead.id, full_name: msgLead.full_name, mobile: msgLead.mobile }}
          onClose={() => setMsgLead(null)}
        />
      )}
    </div>
  );
}

function LeadCard({
  lead, onResult, onEdit, onMsg,
}: { lead: Lead; onResult: () => void; onEdit: () => void; onMsg: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [deleting, setDeleting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const hasInfo = lead.field || lead.grade || lead.goal || lead.gpa != null || lead.city || lead.lead_source;
  // «اقدام‌شده» = نتیجه‌ای برایش ثبت شده (کارت کم‌رنگ‌تر می‌شود تا از کارهای باقی‌مانده جدا شود)
  const actioned = !!lead.last_outcome;
  const intl = toIntl(lead.mobile);

  async function onDelete() {
    if (!confirm(`شماره‌ی «${lead.full_name || lead.mobile}» حذف شود؟ این کار قابل بازگشت نیست.`)) return;
    if (DEMO) { alert("در حالت نمایشی حذف نمی‌شود."); return; }
    setDeleting(true);
    try {
      await api.delete(`/students/${lead.id}`);
      qc.invalidateQueries({ queryKey: ["today-leads"] });
      qc.invalidateQueries({ queryKey: ["students"] });
      toast("شماره حذف شد ✓");
    } catch {
      alert("حذف ناموفق بود.");
      setDeleting(false);
    }
  }
  return (
    <div className={`flex flex-col gap-3 rounded-2xl border p-3.5 shadow-sm transition hover:shadow-md ${
      actioned
        ? "border-emerald-200 bg-emerald-50/40"
        : "border-slate-100 bg-gradient-to-br from-white to-slate-50/60"
    }`}>
      {/* نام + شماره */}
      <div className="flex items-center gap-2.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 font-bold text-blue-600">
          {(lead.full_name ?? "?").charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold text-slate-800">{lead.full_name || "بدون نام"}</div>
          <div className="text-xs text-slate-400" dir="ltr">{lead.mobile}</div>
        </div>
        {!!lead.call_count && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">
            {faNum(lead.call_count)} تماس
          </span>
        )}
      </div>

      {/* نتیجه‌ی ثبت‌شده + علامتِ «اقدام‌شده» */}
      {lead.last_outcome && (
        <div className="flex items-center gap-1.5">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
            OUTCOME_TONE[lead.last_outcome] ?? "bg-slate-100 text-slate-600"
          }`}>
            <ClipboardCheck size={12} /> نتیجه: {lead.last_outcome}
          </span>
          <span className="text-[11px] text-emerald-600">✓ اقدام‌شده</span>
        </div>
      )}

      {/* باکس‌های اطلاعات: پایه/رشته · هدف · معدل · شهر · منبع */}
      {hasInfo ? (
        <div className="flex flex-wrap gap-1.5 text-xs">
          {(lead.field || lead.grade) && (
            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-indigo-700">
              {[lead.grade, lead.field].filter(Boolean).join(" · ")}
            </span>
          )}
          {lead.goal && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">🎯 {lead.goal}</span>}
          {lead.gpa != null && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">معدل {faNum(lead.gpa)}</span>}
          {lead.city && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">📍 {lead.city}</span>}
          {lead.lead_source && <span className="rounded-full bg-violet-50 px-2 py-0.5 text-violet-700">{lead.lead_source}</span>}
        </div>
      ) : (
        <p className="text-xs text-slate-400">اطلاعاتش را با دکمه‌ی «مداد» کامل کن.</p>
      )}

      {/* اقدام‌ها: دو دکمه‌ی اصلیِ بزرگ + منوی «بیشتر» (بقیه‌ی کارها با برچسبِ فارسی) */}
      <div className="mt-auto flex items-center gap-2">
        {/* دکمه‌ی اصلی ۱: تماس */}
        <a
          href={`tel:${lead.mobile}`}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-600 active:scale-95"
        >
          <Phone size={16} /> تماس
        </a>
        {/* دکمه‌ی اصلی ۲: ثبت نتیجه */}
        <button
          onClick={onResult}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 active:scale-95"
        >
          <ClipboardCheck size={16} /> ثبت نتیجه
        </button>
        {/* منوی بیشتر */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            title="بیشتر"
            aria-label="کارهای بیشتر"
            className="flex items-center justify-center rounded-xl border border-slate-200 bg-white p-2.5 text-slate-500 transition hover:bg-slate-50"
          >
            <MoreHorizontal size={18} />
          </button>
          {menuOpen && (
            <>
              {/* پشتِ شفاف برای بستن با کلیکِ بیرون */}
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute bottom-full left-0 z-20 mb-1 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                <a
                  href={`https://wa.me/${intl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50"
                >
                  <MessageCircle size={16} className="text-emerald-600" /> واتساپ
                </a>
                <a
                  href={`tg://resolve?phone=${intl}`}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50"
                >
                  <Send size={16} className="text-sky-600" /> تلگرام
                </a>
                <button
                  onClick={() => { onMsg(); setMenuOpen(false); }}
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50"
                >
                  <MessageSquare size={16} className="text-violet-600" /> پیام (پیامک / بله)
                </button>
                <button
                  onClick={() => { onEdit(); setMenuOpen(false); }}
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50"
                >
                  <Pencil size={16} className="text-blue-600" /> ویرایش اطلاعات
                </button>
                <button
                  onClick={() => { setMenuOpen(false); onDelete(); }}
                  disabled={deleting}
                  className="flex w-full items-center gap-2.5 border-t border-slate-100 px-3 py-2.5 text-sm text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                >
                  {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />} حذف شماره
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- مودال ثبت نتیجه‌ی تماسِ سرنخ (+ خرید → فیش، + تماس بعدی → پیگیری) ---------- */
function LeadResultModal({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [outcome, setOutcome] = useState("");
  const [nextDate, setNextDate] = useState("");
  const [nextTime, setNextTime] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const isPurchase = outcome === "purchased";

  const { data: meta } = useQuery<SaleMeta>({
    queryKey: ["sales-meta"],
    queryFn: async () => (await api.get("/sales/meta")).data,
    enabled: isPurchase && !DEMO,
  });

  const [sel, setSel] = useState<Record<string, { months: number | "" }>>({});
  const [payAmount, setPayAmount] = useState("");
  const [saleDate, setSaleDate] = useState("");
  const [depDate, setDepDate] = useState("");
  const [depTime, setDepTime] = useState("");
  const [payerCard, setPayerCard] = useState("");
  const [destAccount, setDestAccount] = useState("");
  const [payRef, setPayRef] = useState("");

  function toggle(p: string) {
    setSel((s) => { const n = { ...s }; if (n[p]) delete n[p]; else n[p] = { months: "" }; return n; });
  }
  function patch(p: string, x: Partial<{ months: number | "" }>) {
    setSel((s) => ({ ...s, [p]: { ...s[p], ...x } }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!outcome && !nextDate) { setMsg("حداقل نتیجه یا تاریخ تماس بعدی را وارد کنید."); return; }
    const picked = Object.entries(sel);
    if (isPurchase) {
      if (picked.length === 0) { setMsg("حداقل یک محصول را تیک بزنید."); return; }
      for (const [p, v] of picked) if (p === PROGRAM && !v.months) { setMsg("برای «برنامه»، مدت را انتخاب کنید."); return; }
      if (!payAmount || Number(payAmount) <= 0) { setMsg("مبلغِ واریز را وارد کنید."); return; }
    }
    setMsg(""); setLoading(true);
    try {
      if (DEMO) { setMsg("در حالت نمایشی ذخیره نمی‌شود."); setLoading(false); return; }
      if (isPurchase) {
        await api.post("/sales", {
          student_name: lead.full_name || lead.mobile,
          mobile: lead.mobile,
          student_id: lead.id,
          sold_at: saleDate ? new Date(`${saleDate}T12:00`).toISOString() : null,
          items: picked.map(([product, v]) => ({
            product, program_months: product === PROGRAM ? v.months : null,
          })),
          amount: (Number(payAmount) || 0) * 1000,
          deposited_at: depDate ? new Date(`${depDate}T${depTime || "00:00"}`).toISOString() : null,
          payer_card: payerCard || null,
          dest_account: destAccount || null,
          payment_ref: payRef || null,
        });
      }
      if (nextDate) {
        await api.post("/followups", {
          student_id: lead.id,
          due_at: new Date(`${nextDate}T${nextTime || "09:00"}`).toISOString(),
          note: note || null,
        });
      }
      // نتیجه‌ی مکالمه به‌صورتِ یادداشت روی سرنخ ثبت می‌شود (تماسِ دستی رکوردِ تلفنی ندارد)
      const outcomeText = outcome ? `نتیجه‌ی تماس: ${OUTCOME_LABEL[outcome] ?? outcome}` : "تماس دستی";
      await api.post(`/students/${lead.id}/notes`, {
        body: note ? `${outcomeText} — ${note}` : outcomeText,
      });
      // نتیجه‌ی ساختاریافته روی خودِ سرنخ (برای برچسبِ نتیجه + علامتِ «اقدام‌شده» روی کارت)
      if (outcome) {
        await api.patch(`/students/${lead.id}`, {
          last_outcome: OUTCOME_LABEL[outcome] ?? outcome,
        });
      }
      qc.invalidateQueries({ queryKey: ["today-leads"] });
      qc.invalidateQueries({ queryKey: ["tasks-today"] });
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["students"] });
      toast(isPurchase ? "خرید ثبت و فیش ساخته شد ✓" : "نتیجه‌ی تماس ثبت شد ✓");
      onClose();
    } catch (err) { setMsg(apiErrorMessage(err, "ثبت ناموفق بود.")); setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-bold text-slate-800">
            <ClipboardCheck size={18} className="text-emerald-600" /> ثبت نتیجه‌ی تماس
          </h2>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <p className="mb-3 text-sm text-slate-500">
          {lead.full_name ?? "بدون نام"} · <span dir="ltr">{lead.mobile}</span>
        </p>

        <form onSubmit={submit} className="space-y-4">
          {/* نتیجه‌ی تماس */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">نتیجه‌ی تماس</label>
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

          {/* فرم فیشِ خرید — فقط وقتی نتیجه = «خرید» */}
          {isPurchase && (
            <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/40 p-3">
              <div className="text-sm font-semibold text-emerald-800">ثبت فیش خرید — می‌رود تو لیست فروش</div>
              <div className="space-y-1.5">
                {(meta?.products ?? []).map((p) => {
                  const picked = !!sel[p];
                  return (
                    <div key={p} className={`rounded-lg border p-2 ${picked ? "border-emerald-300 bg-emerald-50/60" : "border-slate-200 bg-white"}`}>
                      <label className="flex cursor-pointer items-center gap-2">
                        <input type="checkbox" checked={picked} onChange={() => toggle(p)} className="h-4 w-4 accent-emerald-600" />
                        <span className="flex-1 text-sm text-slate-700">{p}</span>
                      </label>
                      {picked && p === PROGRAM && (
                        <select
                          value={sel[p].months}
                          onChange={(e) => patch(p, { months: Number(e.target.value) })}
                          className="mt-2 w-full rounded-lg border border-indigo-300 bg-indigo-50/40 px-2 py-2 text-sm outline-none focus:border-indigo-400"
                        >
                          <option value="" disabled>مدت برنامه…</option>
                          {(meta?.program_months ?? []).map((m) => (
                            <option key={m} value={m}>{faNum(m)} ماه</option>
                          ))}
                        </select>
                      )}
                    </div>
                  );
                })}
              </div>
              <div>
                <input
                  type="number" placeholder="مبلغ واریز (هزار تومان)" value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-400" dir="ltr" min={0}
                />
                {Number(payAmount) > 0 && (
                  <div className="mt-1 text-xs text-emerald-600">= {faNum(Number(payAmount) * 1000)} تومان</div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-500">تاریخ فروش:</span>
                <JalaliDatePicker value={saleDate} onChange={setSaleDate} placeholder="امروز" />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-500">تاریخ واریز:</span>
                <JalaliDatePicker value={depDate} onChange={setDepDate} placeholder="تاریخ" />
                <span className="text-xs text-slate-500">ساعت:</span>
                <input type="time" value={depTime} onChange={(e) => setDepTime(e.target.value)}
                  className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-emerald-400" dir="ltr" />
              </div>
              <input placeholder="کارت واریزکننده" value={payerCard} onChange={(e) => setPayerCard(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-400" dir="ltr" />
              <input placeholder="بانک مقصد / حساب ما (به دلخواه)" value={destAccount} onChange={(e) => setDestAccount(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-400" />
              <input placeholder="جزئیات واریز (کد رهگیری) — اختیاری" value={payRef} onChange={(e) => setPayRef(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-400" dir="ltr" />
            </div>
          )}

          {/* تاریخ تماس بعدی — برای «ناموفق»/«مشترک» لازم نیست */}
          {!isPurchase && outcome !== "unsuccessful" && outcome !== "busy" && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                تاریخ و ساعت تماس بعدی <span className="font-normal text-slate-400">(اختیاری)</span>
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-500">تاریخ:</span>
                <JalaliDatePicker value={nextDate} onChange={setNextDate} placeholder="تاریخ (شمسی)" />
                <span className="text-xs text-slate-500">ساعت:</span>
                <input type="time" value={nextTime} onChange={(e) => setNextTime(e.target.value)}
                  className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-emerald-400" dir="ltr" />
              </div>
              <p className="mt-1 text-xs text-slate-400">اگر تاریخ تعیین شود، یک پیگیری ساخته می‌شود (ساعت پیش‌فرض ۹ صبح).</p>
            </div>
          )}

          {/* توضیح */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              توضیح <span className="font-normal text-slate-400">(اختیاری)</span>
            </label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
              placeholder="مثلاً: درخواست اطلاعات بیشتر داشت…"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-400" />
          </div>

          <div className="sticky bottom-0 -mx-5 -mb-5 flex items-center justify-end gap-2 border-t border-slate-100 bg-white px-5 py-3">
            {msg && <span className="mr-auto text-xs text-slate-500">{msg}</span>}
            <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">انصراف</button>
            <button disabled={loading} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60">
              {loading && <Loader2 size={15} className="animate-spin" />} ثبت نتیجه
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ---------- مودال ویرایش/تکمیل اطلاعاتِ سرنخ ---------- */
function LeadEditModal({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [fullName, setFullName] = useState(lead.full_name ?? "");
  const [city, setCity] = useState(lead.city ?? "");
  const [fld, setFld] = useState(lead.field ?? "");
  const [grade, setGrade] = useState(lead.grade ?? "");
  const [goal, setGoal] = useState(lead.goal ?? "");
  const [gpa, setGpa] = useState(lead.gpa != null ? String(lead.gpa) : "");
  const [source, setSource] = useState(lead.lead_source ?? "");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(""); setLoading(true);
    try {
      if (DEMO) { setMsg("در حالت نمایشی ذخیره نمی‌شود."); setLoading(false); return; }
      await api.patch(`/students/${lead.id}`, {
        full_name: fullName || null,
        city: city || null,
        field: fld || null,
        grade: grade || null,
        goal: goal || null,
        gpa: gpa ? Number(gpa) : null,
        lead_source: source || null,
      });
      qc.invalidateQueries({ queryKey: ["today-leads"] });
      qc.invalidateQueries({ queryKey: ["students"] });
      toast("اطلاعات ذخیره شد ✓");
      onClose();
    } catch { setMsg("ذخیره ناموفق بود."); setLoading(false); }
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
        <p className="mb-4 text-sm text-slate-500" dir="ltr">{lead.mobile}</p>
        <form onSubmit={submit} className="space-y-3">
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="نام و نام خانوادگی"
            className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-blue-400" />
          <div className="grid grid-cols-2 gap-3">
            <select value={fld} onChange={(e) => setFld(e.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-400">
              <option value="">رشته…</option>
              {EDIT_FIELDS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
            <select value={grade} onChange={(e) => setGrade(e.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-400">
              <option value="">پایه…</option>
              {EDIT_GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="هدف"
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
            {EDIT_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
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
