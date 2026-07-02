"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Sidebar } from "@/components/Sidebar";
import { BackButton } from "@/components/BackButton";
import { faNum } from "@/lib/utils";
import { levelInfo } from "@/lib/loyalty";
import { Gift, Trophy, Award, Loader2 } from "lucide-react";

type Level = { key: string; title: string | null; min_points: number; benefits: { type: string; value?: number }[] | null };
type Reward = { id: string; key: string | null; title: string | null; cost_points: number; type: string; min_level: string | null };
type LbRow = { student_id: string; level: string; points_lifetime: number; points_balance: number };

const BENEFIT_LABEL: Record<string, string> = {
  discount: "تخفیف",
  priority_support: "اولویت در مشاوره",
  free_session: "جلسه‌ی رایگان",
  free_course: "دوره‌ی رایگان",
};

export default function ClubPage() {
  // اگر ماژولِ باشگاه خاموش/حذف باشد، این کوئری خطا می‌دهد → پیام «غیرفعال».
  const { data: levels, isLoading, isError } = useQuery<Level[]>({
    queryKey: ["loyalty-levels"],
    queryFn: async () => (await api.get("/loyalty/levels")).data.items,
    retry: false,
  });
  const { data: rewards } = useQuery<Reward[]>({
    queryKey: ["loyalty-rewards"],
    queryFn: async () => (await api.get("/loyalty/rewards")).data.items,
    retry: false,
    enabled: !isError,
  });
  const { data: leaderboard } = useQuery<LbRow[]>({
    queryKey: ["loyalty-leaderboard"],
    queryFn: async () => (await api.get("/loyalty/leaderboard")).data.items,
    retry: false,
    enabled: !isError,
  });

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar />
      <main className="flex-1 p-4 md:p-8">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-md shadow-violet-200">
              <Gift size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-white">باشگاه مشتریان</h1>
              <p className="mt-0.5 text-sm text-slate-300">سطوح، پاداش‌ها و برترین‌ها</p>
            </div>
          </div>
          <BackButton dark />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white p-12 text-slate-400 shadow-sm">
            <Loader2 className="animate-spin" size={18} /> در حال بارگذاری…
          </div>
        ) : isError ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm">
            <Gift size={40} className="mx-auto mb-3 opacity-40" />
            باشگاه مشتریان هنوز فعال نشده است.
          </div>
        ) : (
          <div className="space-y-6">
            {/* سطوح */}
            <section className="rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <Award className="text-indigo-500" size={20} />
                <h2 className="font-bold text-slate-800">سطوح و مزایا</h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {(levels ?? []).map((lv) => {
                  const info = levelInfo(lv.key);
                  return (
                    <div key={lv.key} className={`rounded-2xl border p-4 ring-1 ${info.cls}`}>
                      <div className="text-2xl">{info.emoji}</div>
                      <div className="mt-1 text-lg font-extrabold">{info.label}</div>
                      <div className="text-xs opacity-80">از {faNum(lv.min_points)} امتیاز</div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {(lv.benefits ?? []).map((b, i) => (
                          <span key={i} className="rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-medium">
                            {BENEFIT_LABEL[b.type] ?? b.type}{b.value ? ` ${faNum(b.value)}٪` : ""}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* پاداش‌ها */}
            <section className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <Gift className="text-emerald-500" size={20} />
                <h2 className="font-bold text-slate-800">کاتالوگِ پاداش‌ها</h2>
                <span className="text-xs text-slate-400">(امتیازت را خرج کن)</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {(rewards ?? []).map((r) => (
                  <div key={r.id} className="flex flex-col rounded-2xl border border-slate-100 bg-gradient-to-br from-white to-emerald-50/40 p-4 shadow-sm">
                    <div className="font-bold text-slate-800">{r.title ?? r.key}</div>
                    {r.min_level && (
                      <div className="mt-1 text-[11px] text-slate-400">ویژه‌ی سطحِ {levelInfo(r.min_level).label} به بالا</div>
                    )}
                    <div className="mt-auto pt-3 text-lg font-extrabold text-emerald-600">
                      {faNum(r.cost_points)} امتیاز
                    </div>
                  </div>
                ))}
                {(rewards ?? []).length === 0 && (
                  <p className="col-span-full py-6 text-center text-sm text-slate-400">پاداشی ثبت نشده.</p>
                )}
              </div>
            </section>

            {/* رتبه‌بندی */}
            <section className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <Trophy className="text-amber-500" size={20} />
                <h2 className="font-bold text-slate-800">برترین‌ها</h2>
                <span className="text-xs text-slate-400">(بر اساس کلِ امتیاز)</span>
              </div>
              <div className="space-y-2">
                {(leaderboard ?? []).map((row, i) => {
                  const info = levelInfo(row.level);
                  return (
                    <div key={row.student_id} className="flex items-center gap-3 rounded-xl border border-slate-100 p-2.5">
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                        i === 0 ? "bg-amber-100 text-amber-700" : i === 1 ? "bg-slate-200 text-slate-600" : i === 2 ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-500"
                      }`}>
                        {faNum(i + 1)}
                      </div>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${info.cls}`}>
                        {info.emoji} {info.label}
                      </span>
                      <span className="mr-auto text-sm font-extrabold text-slate-700">
                        {faNum(row.points_lifetime)} امتیاز
                      </span>
                    </div>
                  );
                })}
                {(leaderboard ?? []).length === 0 && (
                  <p className="py-6 text-center text-sm text-slate-400">هنوز امتیازی ثبت نشده.</p>
                )}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
