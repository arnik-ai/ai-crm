"use client";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { api } from "@/lib/api";
import { Sidebar } from "@/components/Sidebar";
import { BackButton } from "@/components/BackButton";
import { faNum, faDateTime } from "@/lib/utils";
import { getSession, isManager } from "@/lib/auth";
import { ExportButton } from "@/components/ExportButton";
import { exportToExcel } from "@/lib/exportExcel";
import {
  BarChart3,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Trophy,
  Lock,
  Award,
  FileSpreadsheet,
  MessageSquare,
  AlertTriangle,
} from "lucide-react";

const CHANNEL_FA: Record<string, string> = {
  sms: "پیامک", whatsapp: "واتساپ", telegram: "تلگرام",
};

type CommMessage = {
  id: string; student_name: string | null; mobile: string | null;
  channel: string; body: string; status: string; date: string;
};
type IncompleteStudent = {
  id: string; full_name: string | null; mobile: string | null; missing: string[];
};
type TimelineItem = {
  id: string; student_name: string | null; mobile: string | null; product: string;
  arrived_at: string | null; first_call_at: string | null; sold_at: string | null;
  calls_to_purchase: number; days_to_purchase: number | null;
  days_from_first_call: number | null;
};
type RepeatPurchase = {
  product: string; amount: number; sold_at: string | null; days_since_prev: number | null;
};
type RepeatCustomer = {
  mobile: string; student_name: string | null; count: number;
  total_amount: number; purchases: RepeatPurchase[];
};
type HourlyStats = {
  hours: number[];
  answered: number[];
  missed: number[];
  calls: number[];
  payments_count: number[];
  payments_amount: number[];
  avg_duration: { overall_min: number; per_agent: { agent: string; min: number }[] };
};

/** ساعتِ اوج یک آرایه‌ی ۲۴تایی را به‌صورت «۱۶ تا ۱۷» برمی‌گرداند. */
function peakHour(arr?: number[]): string {
  if (!arr || arr.length === 0) return "—";
  let bi = 0;
  for (let i = 1; i < arr.length; i++) if (arr[i] > arr[bi]) bi = i;
  if (arr[bi] === 0) return "—";
  return `${faNum(bi)} تا ${faNum(bi + 1)}`;
}

type DailyReport = {
  date: string;
  inbound: number;
  outbound: number;
  missed: number;
  successful: number;
  unsuccessful: number;
  busy: number;
  follow_up: number;
  total_calls: number;
  total_minutes: number;
};

type Agent = {
  id: string;
  full_name: string;
  students: number;
  calls: number;
  sales_count?: number;
  sales_amount?: number;
};

type MonthCell = {
  calls: number;
  minutes: number;
  sales: number;
  followups: number;
  score: number;
  level: string;
};

type MonthlyAgent = {
  id: string;
  full_name: string;
  avg_score: number;
  level: string;
  months: Record<string, MonthCell>;
};

type MonthlyPerformance = {
  months: string[];
  agents: MonthlyAgent[];
};

const card =
  "rounded-2xl border bg-white p-4 shadow-sm flex items-center gap-3";

/** کلاس رنگی سلول بر اساس سطح عملکرد (مطابق رنگ‌بندی اکسل کارفرما). */
function levelClass(level?: string): string {
  if (level === "خوب") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (level === "قابل قبول") return "bg-amber-50 text-amber-700 ring-amber-200";
  return "bg-rose-50 text-rose-700 ring-rose-200"; // ضعیف
}

/** خروجی اکسل عملکرد ماهانه — ساختار تو-در-تو را به ردیف‌های مسطح تبدیل می‌کند. */
function exportMonthly(monthly?: MonthlyPerformance): void {
  if (!monthly?.agents?.length) return;
  const months = monthly.months ?? [];
  const rows = monthly.agents.map((a) => {
    const row: Record<string, string | number> = { کارشناس: a.full_name };
    for (const m of months) {
      row[m] = a.months[m]?.score ?? "";
    }
    row["میانگین"] = a.avg_score;
    row["سطح"] = a.level;
    return row;
  });
  const columns = [
    { key: "کارشناس", label: "کارشناس" },
    ...months.map((m) => ({ key: m, label: m })),
    { key: "میانگین", label: "میانگین امتیاز" },
    { key: "سطح", label: "سطح" },
  ];
  exportToExcel(rows, columns, "عملکرد-ماهانه");
}

export default function ReportsPage() {
  // گارد نقش: این صفحه «پنل مدیر فروش» است و فقط برای مدیر/ادمین باز است.
  // وضعیت سه‌حالته: null = هنوز در حال بررسی (قبل از mount).
  const [allowed, setAllowed] = useState<boolean | null>(null);
  useEffect(() => {
    setAllowed(isManager(getSession()));
  }, []);

  const enabled = allowed === true;

  const { data: rep } = useQuery<DailyReport>({
    queryKey: ["daily-report"],
    queryFn: async () => (await api.get("/dashboard/daily-report")).data,
    enabled,
  });
  const { data: team } = useQuery({
    queryKey: ["team"],
    queryFn: async () => (await api.get("/dashboard/team")).data,
    enabled,
  });
  const { data: perf } = useQuery({
    queryKey: ["daily-performance"],
    queryFn: async () => (await api.get("/dashboard/daily-performance")).data,
    enabled,
  });
  const { data: monthly } = useQuery<MonthlyPerformance>({
    queryKey: ["monthly-performance"],
    queryFn: async () => (await api.get("/dashboard/monthly-performance")).data,
    enabled,
  });

  // بازه‌ی تاریخ برای گزارش ارتباطات (خالی = همه)
  const [commFrom, setCommFrom] = useState("");
  const [commTo, setCommTo] = useState("");
  const { data: comms } = useQuery<{ items: CommMessage[] }>({
    queryKey: ["messages", commFrom, commTo],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (commFrom) qs.set("date_from", commFrom);
      if (commTo) qs.set("date_to", commTo);
      const suffix = qs.toString() ? `?${qs.toString()}` : "";
      return (await api.get(`/messages${suffix}`)).data;
    },
    enabled,
  });
  const { data: incomplete } = useQuery<{ items: IncompleteStudent[] }>({
    queryKey: ["students-incomplete"],
    queryFn: async () => (await api.get("/students/incomplete")).data,
    enabled,
  });
  const { data: timeline } = useQuery<{ items: TimelineItem[] }>({
    queryKey: ["sales-timeline"],
    queryFn: async () => (await api.get("/sales/timeline")).data,
    enabled,
  });
  const { data: repeat } = useQuery<{ items: RepeatCustomer[] }>({
    queryKey: ["sales-repeat"],
    queryFn: async () => (await api.get("/sales/repeat-customers")).data,
    enabled,
  });
  const commItems = comms?.items ?? [];
  const incompleteItems = incomplete?.items ?? [];
  const timelineItems = timeline?.items ?? [];
  const repeatItems = repeat?.items ?? [];

  // آمار ساعتی (کلی یا تفکیک نیرو)
  const [hourAgent, setHourAgent] = useState("");
  const { data: hourly } = useQuery<HourlyStats>({
    queryKey: ["hourly", hourAgent],
    queryFn: async () => {
      const suffix = hourAgent ? `?agent=${hourAgent}` : "";
      return (await api.get(`/dashboard/hourly${suffix}`)).data;
    },
    enabled,
  });
  const hourlyRows = useMemo(() => {
    const h = hourly?.hours ?? [];
    return h.map((hr, i) => ({
      hour: faNum(hr),
      پاسخ: hourly?.answered?.[i] ?? 0,
      بی‌پاسخ: hourly?.missed?.[i] ?? 0,
      تماس: hourly?.calls?.[i] ?? 0,
      واریز: hourly?.payments_count?.[i] ?? 0,
    }));
  }, [hourly]);
  const agentDurationRows = (hourly?.avg_duration?.per_agent ?? []).map((a) => ({
    agent: a.agent, دقیقه: a.min,
  }));

  // کارشناس فروش: پیام عدم دسترسی به‌جای جدول خالی.
  if (allowed === false) {
    return (
      <div className="flex min-h-screen flex-col md:flex-row">
        <Sidebar />
        <main className="flex-1 p-4 md:p-8">
          <div className="mb-6 flex items-center justify-between gap-3">
            <h1 className="text-2xl font-extrabold text-white">پنل مدیر فروش</h1>
            <BackButton dark />
          </div>
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-500">
              <Lock size={26} />
            </div>
            <h2 className="text-lg font-bold text-slate-800">دسترسی محدود</h2>
            <p className="max-w-sm text-sm text-slate-500">
              این بخش مخصوص مدیر فروش است. حساب شما (کارشناس فروش) به گزارش‌های
              مدیریتی و عملکرد تیم دسترسی ندارد.
            </p>
          </div>
        </main>
      </div>
    );
  }

  // مرتب‌سازی کارشناسان بر اساس مبلغ فروش (کی بیشتر فروخته)
  const agents: Agent[] = [...(team?.agents ?? [])].sort(
    (a, b) => (b.sales_amount ?? 0) - (a.sales_amount ?? 0)
  );
  const maxSales = agents[0]?.sales_amount ?? 1;

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar />
      <main className="flex-1 p-4 md:p-8">
        {/* سرتیتر */}
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-md shadow-amber-200">
              <BarChart3 size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-white">گزارش روزانه</h1>
              <p className="mt-0.5 text-sm text-slate-300">
                {rep?.date ?? "—"} · خلاصه‌ی تماس‌ها و عملکرد تیم
              </p>
            </div>
          </div>
          <BackButton dark />
        </div>

        {/* کارت‌های گزارش روز */}
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className={`${card} border-blue-100`}>
            <PhoneIncoming className="text-blue-500" size={26} />
            <div>
              <div className="text-2xl font-extrabold text-slate-800">{faNum(rep?.inbound ?? 0)}</div>
              <div className="text-xs text-slate-500">تماس ورودی</div>
            </div>
          </div>
          <div className={`${card} border-emerald-100`}>
            <PhoneOutgoing className="text-emerald-500" size={26} />
            <div>
              <div className="text-2xl font-extrabold text-slate-800">{faNum(rep?.outbound ?? 0)}</div>
              <div className="text-xs text-slate-500">تماس خروجی</div>
            </div>
          </div>
          <div className={`${card} border-rose-100`}>
            <PhoneMissed className="text-rose-500" size={26} />
            <div>
              <div className="text-2xl font-extrabold text-slate-800">{faNum(rep?.missed ?? 0)}</div>
              <div className="text-xs text-slate-500">بی‌پاسخ</div>
            </div>
          </div>
          <div className={`${card} border-violet-100`}>
            <Clock className="text-violet-500" size={26} />
            <div>
              <div className="text-2xl font-extrabold text-slate-800">
                {faNum(rep?.total_minutes ?? 0)}
              </div>
              <div className="text-xs text-slate-500">دقیقه مکالمه</div>
            </div>
          </div>
        </div>

        {/* نتیجه‌ی تماس‌ها */}
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className={`${card} border-emerald-100`}>
            <CheckCircle2 className="text-emerald-500" size={26} />
            <div>
              <div className="text-2xl font-extrabold text-slate-800">{faNum(rep?.successful ?? 0)}</div>
              <div className="text-xs text-slate-500">موفق</div>
            </div>
          </div>
          <div className={`${card} border-rose-100`}>
            <XCircle className="text-rose-500" size={26} />
            <div>
              <div className="text-2xl font-extrabold text-slate-800">{faNum(rep?.unsuccessful ?? 0)}</div>
              <div className="text-xs text-slate-500">ناموفق</div>
            </div>
          </div>
          <div className={`${card} border-amber-100`}>
            <RefreshCw className="text-amber-500" size={26} />
            <div>
              <div className="text-2xl font-extrabold text-slate-800">{faNum(rep?.busy ?? 0)}</div>
              <div className="text-xs text-slate-500">مشترک/مشغول</div>
            </div>
          </div>
          <div className={`${card} border-blue-100`}>
            <RefreshCw className="text-blue-500" size={26} />
            <div>
              <div className="text-2xl font-extrabold text-slate-800">{faNum(rep?.follow_up ?? 0)}</div>
              <div className="text-xs text-slate-500">پیگیری</div>
            </div>
          </div>
        </div>

        {/* پنل مدیر فروش: رتبه‌بندی کارشناسان */}
        <div className="rounded-2xl border border-amber-100 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-2">
            <Trophy className="text-amber-500" size={20} />
            <h2 className="font-bold text-slate-800">عملکرد کارشناسان فروش</h2>
            <span className="text-xs text-slate-400">(مرتب‌شده بر اساس مبلغ فروش)</span>
          </div>
          <div className="space-y-3">
            {agents.map((a, i) => (
              <div key={a.id} className="flex items-center gap-3">
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                    i === 0
                      ? "bg-amber-100 text-amber-700"
                      : i === 1
                      ? "bg-slate-200 text-slate-600"
                      : i === 2
                      ? "bg-orange-100 text-orange-700"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {faNum(i + 1)}
                </div>
                <div className="w-28 shrink-0 font-medium text-slate-700">{a.full_name}</div>
                <div className="flex-1">
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-l from-amber-400 to-orange-500"
                      style={{ width: `${Math.round(((a.sales_amount ?? 0) / maxSales) * 100)}%` }}
                    />
                  </div>
                </div>
                <div className="w-16 shrink-0 text-center text-sm font-bold text-slate-700">
                  {faNum(a.sales_count ?? 0)} فروش
                </div>
                <div className="w-32 shrink-0 text-left text-sm font-extrabold text-emerald-600">
                  {faNum(Math.round((a.sales_amount ?? 0) / 10_000_000))} م تومان
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* جدول عملکرد روز (مطابق عکس ۴ کارفرما) */}
        <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 p-4">
            <span className="font-bold text-slate-800">عملکرد روز</span>
            <ExportButton
              rows={perf?.items ?? []}
              columns={[
                { key: "date", label: "تاریخ" },
                { key: "total", label: "کل تماس" },
                { key: "sales", label: "فروش روز" },
                { key: "customers", label: "مشتری" },
                { key: "successful", label: "موفق" },
                { key: "busy", label: "مشترک" },
                { key: "unsuccessful", label: "ناموفق" },
                { key: "not_handled", label: "اقدام نشده" },
                { key: "missed", label: "بی‌پاسخ" },
                { key: "follow_up", label: "پیگیری" },
                { key: "minutes", label: "دقیقه" },
              ]}
              filename="عملکرد-روز"
            />
          </div>
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="p-3 text-right font-medium">تاریخ</th>
                <th className="p-3 text-center font-medium">کل تماس</th>
                <th className="p-3 text-center font-medium">فروش روز</th>
                <th className="p-3 text-center font-medium">مشتری</th>
                <th className="p-3 text-center font-medium">موفق</th>
                <th className="p-3 text-center font-medium">مشترک</th>
                <th className="p-3 text-center font-medium">ناموفق</th>
                <th className="p-3 text-center font-medium">اقدام نشده</th>
                <th className="p-3 text-center font-medium">بی‌پاسخ</th>
                <th className="p-3 text-center font-medium">پیگیری</th>
                <th className="p-3 text-center font-medium">دقیقه</th>
              </tr>
            </thead>
            <tbody>
              {(perf?.items ?? []).map((d: any, i: number) => (
                <tr key={d.date} className={`border-t border-slate-100 ${i % 2 === 1 ? "bg-slate-50/40" : ""}`}>
                  <td className="p-3 font-medium text-slate-700" dir="ltr">{d.date}</td>
                  <td className="p-3 text-center text-slate-600">{faNum(d.total)}</td>
                  <td className="p-3 text-center font-bold text-green-600">{faNum(d.sales ?? 0)}</td>
                  <td className="p-3 text-center text-sky-600">{faNum(d.customers ?? 0)}</td>
                  <td className="p-3 text-center font-bold text-emerald-600">{faNum(d.successful)}</td>
                  <td className="p-3 text-center text-amber-600">{faNum(d.busy)}</td>
                  <td className="p-3 text-center text-rose-600">{faNum(d.unsuccessful)}</td>
                  <td className="p-3 text-center text-orange-600">{faNum(d.not_handled ?? 0)}</td>
                  <td className="p-3 text-center text-slate-500">{faNum(d.missed)}</td>
                  <td className="p-3 text-center text-blue-600">{faNum(d.follow_up)}</td>
                  <td className="p-3 text-center text-violet-600">{faNum(d.minutes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* پنل عملکرد نیرو در طول ماه (مطابق عکس ۱ کارفرما) */}
        <div className="mt-6 overflow-x-auto rounded-2xl border border-emerald-100 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 p-4">
            <div className="flex items-center gap-2">
              <Award className="text-emerald-500" size={20} />
              <span className="font-bold text-slate-800">عملکرد نیرو در طول ماه</span>
              <span className="hidden text-xs text-slate-400 sm:inline">(امتیاز از ۱۰۰ · سطح هر کارشناس به تفکیک ماه)</span>
            </div>
            <button
              onClick={() => exportMonthly(monthly)}
              disabled={(monthly?.agents?.length ?? 0) === 0}
              className="inline-flex items-center gap-1.5 rounded-xl bg-green-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-green-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
              title="خروجی اکسل عملکرد ماهانه"
            >
              <FileSpreadsheet size={16} /> خروجی اکسل
            </button>
          </div>
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-gradient-to-l from-emerald-50 to-green-50 text-slate-600">
              <tr>
                <th className="p-3 text-right font-medium">کارشناس</th>
                {(monthly?.months ?? []).map((m) => (
                  <th key={m} className="p-3 text-center font-medium" dir="ltr">{m}</th>
                ))}
                <th className="p-3 text-center font-medium">میانگین</th>
                <th className="p-3 text-center font-medium">سطح</th>
              </tr>
            </thead>
            <tbody>
              {(monthly?.agents ?? []).map((a, i) => (
                <tr key={a.id} className={`border-t border-slate-100 ${i % 2 === 1 ? "bg-slate-50/40" : ""}`}>
                  <td className="p-3 font-medium text-slate-700">{a.full_name}</td>
                  {(monthly?.months ?? []).map((m) => {
                    const cell = a.months[m];
                    return (
                      <td key={m} className="p-2 text-center">
                        {cell ? (
                          <span
                            className={`inline-flex min-w-[3rem] flex-col items-center rounded-lg px-2 py-1 text-xs font-bold ring-1 ${levelClass(cell.level)}`}
                            title={`تماس: ${cell.calls} · دقیقه: ${cell.minutes} · فروش: ${cell.sales} · پیگیری: ${cell.followups}`}
                          >
                            {faNum(cell.score)}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="p-3 text-center font-extrabold text-slate-800">{faNum(a.avg_score)}</td>
                  <td className="p-3 text-center">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${levelClass(a.level)}`}>
                      {a.level}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* حالت خالی */}
          {(monthly?.agents?.length ?? 0) === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-slate-400">
              <Award size={36} className="opacity-40" />
              <p className="text-sm">هنوز داده‌ای برای عملکرد ماهانه ثبت نشده است.</p>
            </div>
          )}
        </div>

        {/* آمار ساعتی + نمودارها */}
        <div className="mt-6 rounded-2xl border border-sky-100 bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <BarChart3 className="text-sky-500" size={20} />
              <span className="font-bold text-slate-800">آمار ساعتی</span>
              <span className="hidden text-xs text-slate-400 sm:inline">(به وقت تهران · کلی یا تفکیک نیرو)</span>
            </div>
            <select
              value={hourAgent}
              onChange={(e) => setHourAgent(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-sky-400"
            >
              <option value="">همه‌ی نیروها (کلی)</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>{a.full_name}</option>
              ))}
            </select>
          </div>

          {/* تیترهای کلیدی */}
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-xl bg-emerald-50 p-3">
              <div className="text-xs text-emerald-600">بیشترین واریز در ساعت</div>
              <div className="text-lg font-extrabold text-emerald-700">{peakHour(hourly?.payments_amount)}</div>
            </div>
            <div className="rounded-xl bg-blue-50 p-3">
              <div className="text-xs text-blue-600">بیشترین پاسخ‌دهی در ساعت</div>
              <div className="text-lg font-extrabold text-blue-700">{peakHour(hourly?.answered)}</div>
            </div>
            <div className="rounded-xl bg-rose-50 p-3">
              <div className="text-xs text-rose-600">بیشترین بی‌پاسخ در ساعت</div>
              <div className="text-lg font-extrabold text-rose-700">{peakHour(hourly?.missed)}</div>
            </div>
            <div className="rounded-xl bg-violet-50 p-3">
              <div className="text-xs text-violet-600">میانگین مکالمه (دقیقه)</div>
              <div className="text-lg font-extrabold text-violet-700">{faNum(hourly?.avg_duration?.overall_min ?? 0)}</div>
            </div>
          </div>

          {/* نمودار تماس‌ها بر اساس ساعت */}
          <div className="mb-2 text-sm font-semibold text-slate-600">تماس‌ها بر اساس ساعت (پاسخ / بی‌پاسخ)</div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={hourlyRows}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
              <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="پاسخ" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="بی‌پاسخ" fill="#f43f5e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>

          {/* نمودار واریز بر اساس ساعت */}
          <div className="mb-2 mt-5 text-sm font-semibold text-slate-600">تعداد واریز بر اساس ساعت</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={hourlyRows}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
              <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="واریز" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>

          {/* میانگین مکالمه‌ی نیروها (فقط در نمای کلی) */}
          {!hourAgent && agentDurationRows.length > 0 && (
            <>
              <div className="mb-2 mt-5 text-sm font-semibold text-slate-600">میانگین مدت مکالمه‌ی هر نیرو (دقیقه)</div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={agentDurationRows} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="agent" tick={{ fontSize: 11 }} width={90} />
                  <Tooltip />
                  <Bar dataKey="دقیقه" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </>
          )}
        </div>

        {/* گزارش ارتباطات: چه پیامی در چه بازه‌ای برای چه کسی ارسال شده */}
        <div className="mt-6 overflow-x-auto rounded-2xl border border-violet-100 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 p-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="text-violet-500" size={20} />
              <span className="font-bold text-slate-800">گزارش ارتباطات</span>
              <span className="hidden text-xs text-slate-400 sm:inline">(پیام‌های ارسالی)</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs text-slate-500">از</label>
              <input type="date" value={commFrom} onChange={(e) => setCommFrom(e.target.value)}
                className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-violet-400" dir="ltr" />
              <label className="text-xs text-slate-500">تا</label>
              <input type="date" value={commTo} onChange={(e) => setCommTo(e.target.value)}
                className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-violet-400" dir="ltr" />
              <ExportButton
                rows={commItems.map((m) => ({ ...m, channel_fa: CHANNEL_FA[m.channel] ?? m.channel, date_fa: faDateTime(m.date) }))}
                columns={[
                  { key: "student_name", label: "نام" },
                  { key: "mobile", label: "موبایل" },
                  { key: "channel_fa", label: "کانال" },
                  { key: "body", label: "متن پیام" },
                  { key: "status", label: "وضعیت" },
                  { key: "date_fa", label: "تاریخ" },
                ]}
                filename="گزارش-ارتباطات"
              />
            </div>
          </div>
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="p-3 text-right font-medium">نام</th>
                <th className="p-3 text-right font-medium">موبایل</th>
                <th className="p-3 text-center font-medium">کانال</th>
                <th className="p-3 text-right font-medium">متن پیام</th>
                <th className="p-3 text-right font-medium">تاریخ</th>
              </tr>
            </thead>
            <tbody>
              {commItems.map((m, i) => (
                <tr key={m.id} className={`border-t border-slate-100 ${i % 2 === 1 ? "bg-slate-50/40" : ""}`}>
                  <td className="p-3 font-medium text-slate-700">{m.student_name ?? "—"}</td>
                  <td className="p-3 text-slate-500" dir="ltr">{m.mobile ?? "—"}</td>
                  <td className="p-3 text-center">
                    <span className="inline-flex rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-600">
                      {CHANNEL_FA[m.channel] ?? m.channel}
                    </span>
                  </td>
                  <td className="p-3 text-slate-600">{m.body}</td>
                  <td className="p-3 text-slate-400">{faDateTime(m.date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {commItems.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-slate-400">
              <MessageSquare size={36} className="opacity-40" />
              <p className="text-sm">در این بازه پیامی ثبت نشده است.</p>
            </div>
          )}
        </div>

        {/* گزارش اطلاعات ناقص */}
        <div className="mt-6 overflow-x-auto rounded-2xl border border-rose-100 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="text-rose-500" size={20} />
              <span className="font-bold text-slate-800">اطلاعات ناقص</span>
              <span className="hidden text-xs text-slate-400 sm:inline">(چه کسی چه چیزی کم دارد)</span>
            </div>
            <ExportButton
              rows={incompleteItems.map((s) => ({ ...s, missing_str: s.missing.join("، ") }))}
              columns={[
                { key: "full_name", label: "نام" },
                { key: "mobile", label: "موبایل" },
                { key: "missing_str", label: "موارد ناقص" },
              ]}
              filename="اطلاعات-ناقص"
            />
          </div>
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="p-3 text-right font-medium">نام</th>
                <th className="p-3 text-right font-medium">موبایل</th>
                <th className="p-3 text-right font-medium">موارد ناقص</th>
              </tr>
            </thead>
            <tbody>
              {incompleteItems.map((s, i) => (
                <tr key={s.id} className={`border-t border-slate-100 ${i % 2 === 1 ? "bg-slate-50/40" : ""}`}>
                  <td className="p-3 font-medium text-slate-700">{s.full_name ?? "—"}</td>
                  <td className="p-3 text-slate-500" dir="ltr">{s.mobile ?? "—"}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1.5">
                      {s.missing.map((m) => (
                        <span key={m} className="rounded-full bg-rose-50 px-2 py-0.5 text-xs text-rose-600 ring-1 ring-rose-100">
                          {m}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {incompleteItems.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-slate-400">
              <CheckCircle2 size={36} className="opacity-40" />
              <p className="text-sm">اطلاعات همه کامل است. 👌</p>
            </div>
          )}
        </div>

        {/* تایم‌لاین ورود → تماس → خرید */}
        <div className="mt-6 overflow-x-auto rounded-2xl border border-emerald-100 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 p-4">
            <div className="flex items-center gap-2">
              <Clock className="text-emerald-500" size={20} />
              <span className="font-bold text-slate-800">تایم‌لاین خرید</span>
              <span className="hidden text-xs text-slate-400 sm:inline">(از ورود تا خرید: چند تماس و چند روز)</span>
            </div>
            <ExportButton
              rows={timelineItems.map((t) => ({
                ...t,
                arrived_fa: faDateTime(t.arrived_at ?? undefined),
                first_call_fa: faDateTime(t.first_call_at ?? undefined),
                sold_fa: faDateTime(t.sold_at ?? undefined),
              }))}
              columns={[
                { key: "student_name", label: "نام" },
                { key: "product", label: "محصول" },
                { key: "arrived_fa", label: "تاریخ ورود" },
                { key: "first_call_fa", label: "اولین تماس" },
                { key: "sold_fa", label: "تاریخ خرید" },
                { key: "calls_to_purchase", label: "تعداد تماس تا خرید" },
                { key: "days_to_purchase", label: "روز تا خرید (از ورود)" },
                { key: "days_from_first_call", label: "روز از اولین تماس" },
              ]}
              filename="تایم‌لاین-خرید"
            />
          </div>
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-gradient-to-l from-emerald-50 to-green-50 text-slate-600">
              <tr>
                <th className="p-3 text-right font-medium">نام</th>
                <th className="p-3 text-right font-medium">محصول</th>
                <th className="p-3 text-center font-medium">ورود</th>
                <th className="p-3 text-center font-medium">اولین تماس</th>
                <th className="p-3 text-center font-medium">خرید</th>
                <th className="p-3 text-center font-medium">تعداد تماس</th>
                <th className="p-3 text-center font-medium">روز تا خرید</th>
              </tr>
            </thead>
            <tbody>
              {timelineItems.map((t, i) => (
                <tr key={t.id} className={`border-t border-slate-100 ${i % 2 === 1 ? "bg-slate-50/40" : ""}`}>
                  <td className="p-3 font-medium text-slate-700">{t.student_name ?? "—"}</td>
                  <td className="p-3 text-slate-600">{t.product}</td>
                  <td className="p-3 text-center text-slate-500">{faDateTime(t.arrived_at ?? undefined)}</td>
                  <td className="p-3 text-center text-slate-500">{faDateTime(t.first_call_at ?? undefined)}</td>
                  <td className="p-3 text-center font-medium text-emerald-600">{faDateTime(t.sold_at ?? undefined)}</td>
                  <td className="p-3 text-center">
                    <span className="inline-flex min-w-[2rem] justify-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-600">
                      {faNum(t.calls_to_purchase)}
                    </span>
                  </td>
                  <td className="p-3 text-center font-bold text-slate-700">
                    {t.days_to_purchase != null ? `${faNum(t.days_to_purchase)} روز` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {timelineItems.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-slate-400">
              <Clock size={36} className="opacity-40" />
              <p className="text-sm">هنوز خریدی برای نمایش تایم‌لاین ثبت نشده است.</p>
            </div>
          )}
        </div>

        {/* مشتریان چندبارخرید — تعداد خرید، تاریخ‌ها و فاصله‌ی روز بین خریدها */}
        <div className="mt-6 rounded-2xl border border-amber-100 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 p-4">
            <div className="flex items-center gap-2">
              <Clock className="text-amber-500" size={20} />
              <span className="font-bold text-slate-800">مشتریان چندبارخرید</span>
              <span className="hidden text-xs text-slate-400 sm:inline">(هر مشتری چند بار خرید کرده، در چه تاریخ‌هایی و با چه فاصله‌ای)</span>
            </div>
            <ExportButton
              rows={repeatItems.flatMap((c) =>
                c.purchases.map((p, idx) => ({
                  student_name: c.student_name ?? "—",
                  mobile: c.mobile,
                  count: c.count,
                  nth: idx + 1,
                  product: p.product,
                  amount: p.amount,
                  sold_fa: faDateTime(p.sold_at ?? undefined),
                  gap: p.days_since_prev ?? "",
                }))
              )}
              columns={[
                { key: "student_name", label: "نام" },
                { key: "mobile", label: "موبایل" },
                { key: "count", label: "تعداد کل خرید" },
                { key: "nth", label: "خرید شماره" },
                { key: "product", label: "محصول" },
                { key: "amount", label: "مبلغ (تومان)" },
                { key: "sold_fa", label: "تاریخ خرید" },
                { key: "gap", label: "فاصله از خرید قبلی (روز)" },
              ]}
              filename="مشتریان-چندبارخرید"
            />
          </div>
          <div className="divide-y divide-slate-100">
            {repeatItems.map((c) => (
              <div key={c.mobile} className="p-4">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="font-bold text-slate-800">{c.student_name ?? "—"}</span>
                  <span className="text-xs text-slate-400" dir="ltr">{c.mobile}</span>
                  <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-600">
                    {faNum(c.count)} خرید
                  </span>
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-600">
                    جمع: {faNum(Math.round(c.total_amount).toLocaleString("en-US"))} تومان
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {c.purchases.map((p, i) => (
                    <div key={i} className="flex items-center gap-2">
                      {i > 0 && (
                        <span className="text-xs text-slate-400">
                          ← {p.days_since_prev != null ? `${faNum(p.days_since_prev)} روز بعد` : "—"} ←
                        </span>
                      )}
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs">
                        <div className="font-medium text-slate-700">{p.product}</div>
                        <div className="text-slate-400">{faDateTime(p.sold_at ?? undefined)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {repeatItems.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-slate-400">
              <Clock size={36} className="opacity-40" />
              <p className="text-sm">هنوز مشتریِ چندبارخریدی ثبت نشده است.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
