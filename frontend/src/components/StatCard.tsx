import { type LucideIcon } from "lucide-react";
import { cn, faNum } from "@/lib/utils";

type Props = {
  label: string;
  value: number | string;
  icon: LucideIcon;
  /** رنگ تم کارت */
  tone?: "blue" | "rose" | "amber" | "emerald" | "violet" | "slate";
  hint?: string;
  isPercent?: boolean;
};

const tones: Record<string, { ring: string; icon: string; glow: string }> = {
  blue: { ring: "from-blue-500 to-indigo-500", icon: "bg-blue-50 text-blue-600", glow: "shadow-blue-100" },
  rose: { ring: "from-rose-500 to-pink-500", icon: "bg-rose-50 text-rose-600", glow: "shadow-rose-100" },
  amber: { ring: "from-amber-500 to-orange-500", icon: "bg-amber-50 text-amber-600", glow: "shadow-amber-100" },
  emerald: { ring: "from-emerald-500 to-green-500", icon: "bg-emerald-50 text-emerald-600", glow: "shadow-emerald-100" },
  violet: { ring: "from-violet-500 to-purple-500", icon: "bg-violet-50 text-violet-600", glow: "shadow-violet-100" },
  slate: { ring: "from-slate-400 to-slate-500", icon: "bg-slate-100 text-slate-600", glow: "shadow-slate-100" },
};

export function StatCard({ label, value, icon: Icon, tone = "blue", hint, isPercent }: Props) {
  const t = tones[tone];
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-5",
        "shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg",
        t.glow
      )}
    >
      {/* نوار رنگی بالای کارت */}
      <div className={cn("absolute inset-x-0 top-0 h-1 bg-gradient-to-l", t.ring)} />

      <div className="flex items-start justify-between">
        <div className={cn("rounded-xl p-2.5", t.icon)}>
          <Icon size={22} />
        </div>
      </div>

      <div className="mt-4">
        <div className="text-3xl font-extrabold tracking-tight text-slate-800">
          {typeof value === "number" ? faNum(value) : value}
          {isPercent && <span className="text-xl">٪</span>}
        </div>
        <div className="mt-1 text-sm font-medium text-slate-500">{label}</div>
        {hint && <div className="mt-2 text-xs text-slate-400">{hint}</div>}
      </div>
    </div>
  );
}
