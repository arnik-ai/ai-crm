"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
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

const cards = (s: Summary) => [
  { label: "تماس‌های امروز", value: s.calls_today },
  { label: "تماس‌های هفته", value: s.calls_week },
  { label: "سرنخ‌های داغ", value: s.hot_leads },
  { label: "سرنخ‌های گرم", value: s.warm_leads },
  { label: "سرنخ‌های سرد", value: s.cold_leads },
  { label: "پیگیری‌های امروز", value: s.followups_today },
  { label: "نرخ تبدیل", value: `${Math.round(s.conversion_rate * 100)}%` },
];

export default function DashboardPage() {
  const { data: summary } = useQuery<Summary>({
    queryKey: ["summary"],
    queryFn: async () => (await api.get("/dashboard/summary")).data,
  });
  const { data: funnel } = useQuery({
    queryKey: ["funnel"],
    queryFn: async () => (await api.get("/dashboard/funnel")).data,
  });

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">داشبورد مدیر فروش</h1>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {summary &&
          cards(summary).map((c) => (
            <div key={c.label} className="card">
              <div className="text-sm text-slate-500">{c.label}</div>
              <div className="mt-2 text-2xl font-bold">{c.value}</div>
            </div>
          ))}
      </div>

      <div className="card">
        <h2 className="mb-4 font-semibold">قیف فروش</h2>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={funnel?.stages ?? []}>
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#2563eb" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
