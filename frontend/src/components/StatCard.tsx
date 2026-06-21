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

// پالت پاستیلیِ نرم و جوان‌پسند:
// bg = پس‌زمینه‌ی گرادیانت ملایم، text = رنگ عدد، chip = پس‌زمینه‌ی آیکون،
// iconC = رنگ آیکون، glow = درخشش گوشه، border = حاشیه‌ی رنگی هماهنگ
const tones: Record<
  string,
  { bg: string; text: string; chip: string; iconC: string; glow: string; border: string }
> = {
  blue: {
    bg: "from-sky-100 to-indigo-100",
    text: "text-indigo-700",
    chip: "bg-white/70",
    iconC: "text-indigo-500",
    glow: "bg-indigo-200",
    border: "border-indigo-200",
  },
  rose: {
    bg: "from-rose-100 to-pink-100",
    text: "text-rose-600",
    chip: "bg-white/70",
    iconC: "text-rose-500",
    glow: "bg-rose-200",
    border: "border-rose-200",
  },
  amber: {
    bg: "from-amber-100 to-orange-100",
    text: "text-orange-600",
    chip: "bg-white/70",
    iconC: "text-orange-500",
    glow: "bg-orange-200",
    border: "border-orange-200",
  },
  emerald: {
    bg: "from-emerald-100 to-teal-100",
    text: "text-emerald-700",
    chip: "bg-white/70",
    iconC: "text-emerald-500",
    glow: "bg-emerald-200",
    border: "border-emerald-200",
  },
  violet: {
    bg: "from-violet-100 to-fuchsia-100",
    text: "text-violet-700",
    chip: "bg-white/70",
    iconC: "text-violet-500",
    glow: "bg-violet-200",
    border: "border-violet-200",
  },
  slate: {
    bg: "from-slate-100 to-slate-200",
    text: "text-slate-700",
    chip: "bg-white/70",
    iconC: "text-slate-500",
    glow: "bg-slate-200",
    border: "border-slate-300",
  },
};

export function StatCard({ label, value, icon: Icon, tone = "blue", hint, isPercent }: Props) {
  const t = tones[tone];
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-3xl border-2 bg-gradient-to-br p-5",
        "shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-lg",
        t.bg,
        t.border
      )}
    >
      {/* آیکون بزرگِ کم‌رنگ در پس‌زمینه */}
      <Icon
        className={cn(
          "pointer-events-none absolute -left-3 -top-3 opacity-20 transition-transform duration-500 group-hover:scale-110",
          t.iconC
        )}
        size={104}
      />
      {/* درخشش پاستیلی گوشه */}
      <div className={cn("pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-50 blur-2xl", t.glow)} />

      <div className="relative">
        <div className={cn("inline-flex rounded-2xl p-2.5 shadow-sm backdrop-blur-sm", t.chip)}>
          <Icon size={20} className={t.iconC} />
        </div>

        <div className="mt-5">
          <div className={cn("text-3xl font-extrabold tracking-tight", t.text)}>
            {typeof value === "number" ? faNum(value) : value}
            {isPercent && <span className="text-xl">٪</span>}
          </div>
          <div className="mt-1 text-sm font-semibold text-slate-600">{label}</div>
          {hint && <div className="mt-2 text-xs text-slate-400">{hint}</div>}
        </div>
      </div>
    </div>
  );
}
