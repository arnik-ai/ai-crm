"use client";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Sidebar } from "@/components/Sidebar";
import { BackButton } from "@/components/BackButton";
import { faNum } from "@/lib/utils";
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
} from "lucide-react";

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
      </main>
    </div>
  );
}
