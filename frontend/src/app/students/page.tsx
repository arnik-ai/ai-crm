"use client";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Sidebar } from "@/components/Sidebar";
import { CallButton } from "@/components/CallButton";
import { ScoreLegend } from "@/components/ScoreLegend";
import { BackButton } from "@/components/BackButton";
import { Search, Users, GraduationCap } from "lucide-react";

type Student = {
  id: string;
  full_name: string | null;
  mobile: string;
  status: string;
  course?: string;
  grade?: string;
  goal?: string;
  lead_score?: number;
  stage?: string;
  last_call?: string;
};

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

export default function StudentsPage() {
  const { data } = useQuery({
    queryKey: ["students"],
    queryFn: async () => (await api.get("/students")).data,
  });

  const [q, setQ] = useState("");
  const [field, setField] = useState("همه");

  const items: Student[] = useMemo(() => {
    let list: Student[] = data?.items ?? [];
    if (field !== "همه") list = list.filter((s) => s.course === field);
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
          <BackButton dark />
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
                <th className="p-3.5 text-right font-medium">رشته</th>
                <th className="p-3.5 text-right font-medium">پایه</th>
                <th className="p-3.5 text-right font-medium">هدف</th>
                <th className="p-3.5 text-center font-medium">امتیاز</th>
                <th className="p-3.5 text-right font-medium">مرحله</th>
                <th className="p-3.5 text-right font-medium">آخرین تماس</th>
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
                  <td className="p-3.5"><FieldBadge field={s.course} /></td>
                  <td className="p-3.5 text-slate-600">{s.grade ?? "—"}</td>
                  <td className="p-3.5 text-slate-500">{s.goal ?? "—"}</td>
                  <td className="p-3.5 text-center"><ScoreBadge score={s.lead_score} /></td>
                  <td className="p-3.5"><StageBadge stage={s.stage} /></td>
                  <td className="p-3.5 text-slate-400">{s.last_call ?? "—"}</td>
                  <td className="p-3.5 text-center">
                    <CallButton mobile={s.mobile} size="sm" />
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
      </main>
    </div>
  );
}
