"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { StatCard } from "@/components/StatCard";
import { ChartCard } from "@/components/ChartCard";
import { CallButton } from "@/components/CallButton";
import { BackButton } from "@/components/BackButton";
import { faNum } from "@/lib/utils";
import {
  PhoneCall,
  CalendarDays,
  Flame,
  Sun,
  Snowflake,
  BellRing,
  TrendingUp,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";

type Summary = {
  calls_today: number;
  calls_week: number;
  hot_leads: number;
  warm_leads: number;
  cold_leads: number;
  followups_today: number;
  conversion_rate: number;
};

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("fa-IR", { weekday: "short" });

export default function DashboardPage() {
  const { data: s } = useQuery<Summary>({
    queryKey: ["summary"],
    queryFn: async () => (await api.get("/dashboard/summary")).data,
  });
  const { data: funnel } = useQuery({
    queryKey: ["funnel"],
    queryFn: async () => (await api.get("/dashboard/funnel")).data,
  });
  const { data: trend } = useQuery({
    queryKey: ["trend"],
    queryFn: async () => (await api.get("/dashboard/calls-trend")).data,
  });
  const { data: followups } = useQuery({
    queryKey: ["followups-today"],
    queryFn: async () => (await api.get("/dashboard/followups/today")).data,
  });

  const leadPie = s
    ? [
        { name: "داغ", value: s.hot_leads, color: "#f43f5e" },
        { name: "گرم", value: s.warm_leads, color: "#f59e0b" },
        { name: "سرد", value: s.cold_leads, color: "#3b82f6" },
      ]
    : [];

  return (
    <div className="space-y-8">
      {/* سرتیتر */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white">داشبورد مدیر فروش</h1>
          <p className="mt-1 text-sm text-slate-300">
            نمای کلی عملکرد فروش و سرنخ‌ها
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-full bg-gradient-to-l from-sky-100 to-indigo-100 px-4 py-2 text-sm font-semibold text-indigo-600 ring-1 ring-white/60">
            {new Date().toLocaleDateString("fa-IR", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </div>
          <BackButton dark />
        </div>
      </div>

      {/* کارت‌های آماری */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="تماس‌های امروز" value={s?.calls_today ?? 0} icon={PhoneCall} tone="blue" />
        <StatCard label="تماس‌های این هفته" value={s?.calls_week ?? 0} icon={CalendarDays} tone="violet" />
        <StatCard label="پیگیری‌های امروز" value={s?.followups_today ?? 0} icon={BellRing} tone="amber" />
        <StatCard
          label="نرخ تبدیل"
          value={s ? Math.round(s.conversion_rate * 100) : 0}
          icon={TrendingUp}
          tone="emerald"
          isPercent
          hint="درصد سرنخ‌های ثبت‌نام‌شده"
        />
        <StatCard label="سرنخ‌های داغ" value={s?.hot_leads ?? 0} icon={Flame} tone="rose" hint="امتیاز بالای ۷۰" />
        <StatCard label="سرنخ‌های گرم" value={s?.warm_leads ?? 0} icon={Sun} tone="amber" hint="امتیاز ۴۰ تا ۶۹" />
        <StatCard label="سرنخ‌های سرد" value={s?.cold_leads ?? 0} icon={Snowflake} tone="blue" hint="امتیاز زیر ۴۰" />
        <StatCard label="مجموع سرنخ‌ها" value={(s?.hot_leads ?? 0) + (s?.warm_leads ?? 0) + (s?.cold_leads ?? 0)} icon={TrendingUp} tone="slate" />
      </div>

      {/* ردیف نمودارها */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* روند تماس‌ها — ۲ ستون */}
        <ChartCard title="روند تماس‌ها" subtitle="۷ روز اخیر" className="lg:col-span-2">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend?.points ?? []} margin={{ right: 8, left: -20 }}>
                <defs>
                  <linearGradient id="gIn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gOut" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 12, fill: "#94a3b8" }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#94a3b8" }} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }}
                  labelFormatter={(d) => new Date(d).toLocaleDateString("fa-IR")}
                />
                <Legend iconType="circle" />
                <Area type="monotone" dataKey="inbound" name="ورودی" stroke="#3b82f6" strokeWidth={2.5} fill="url(#gIn)" />
                <Area type="monotone" dataKey="outbound" name="خروجی" stroke="#10b981" strokeWidth={2.5} fill="url(#gOut)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* دونات دسته‌بندی سرنخ */}
        <ChartCard title="دسته‌بندی سرنخ‌ها" subtitle="بر اساس امتیاز هوش مصنوعی">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={leadPie}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={3}
                >
                  {leadPie.map((e) => (
                    <Cell key={e.name} fill={e.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }}
                  formatter={(v: number) => faNum(v)}
                />
                <Legend iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      {/* قیف فروش */}
      <ChartCard title="قیف فروش" subtitle="توزیع سرنخ‌ها در مراحل فروش">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={funnel?.stages ?? []} margin={{ right: 8, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748b" }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#94a3b8" }} />
              <Tooltip
                cursor={{ fill: "#f8fafc" }}
                contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }}
                formatter={(v: number) => faNum(v)}
              />
              <Bar dataKey="count" name="تعداد" radius={[8, 8, 0, 0]}>
                {(funnel?.stages ?? []).map((st: any, i: number) => (
                  <Cell key={i} fill={st.color || "#6366f1"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      {/* پیگیری‌های امروز — با دکمه‌ی تماس */}
      <ChartCard title="پیگیری‌های امروز" subtitle="سرنخ‌هایی که امروز باید با آن‌ها تماس بگیری">
        <div className="divide-y divide-slate-100">
          {(followups?.items ?? []).length === 0 && (
            <p className="py-6 text-center text-sm text-slate-400">پیگیری‌ای برای امروز ثبت نشده.</p>
          )}
          {(followups?.items ?? []).map((f: any) => (
            <div key={f.id} className="flex items-center gap-3 py-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 font-bold text-blue-600">
                {(f.student_name ?? "?").charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-700">{f.student_name}</span>
                  {f.lead_score != null && (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">
                      {f.lead_score}
                    </span>
                  )}
                </div>
                <div className="truncate text-xs text-slate-400">
                  {f.course} · {f.note} {f.time && `· ساعت ${f.time}`}
                </div>
              </div>
              <span className="hidden text-xs text-slate-400 sm:block" dir="ltr">
                {f.mobile}
              </span>
              <CallButton mobile={f.mobile} size="sm" />
            </div>
          ))}
        </div>
      </ChartCard>
    </div>
  );
}
