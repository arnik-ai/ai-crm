/** اطلاعاتِ نمایشیِ سطوحِ باشگاه مشتریان (برچسب فارسی + ایموجی + رنگ). */
export const LEVEL_INFO: Record<string, { label: string; emoji: string; cls: string }> = {
  bronze: { label: "برنزی", emoji: "🥉", cls: "bg-amber-100 text-amber-700 ring-amber-200" },
  silver: { label: "نقره‌ای", emoji: "🥈", cls: "bg-slate-200 text-slate-700 ring-slate-300" },
  gold: { label: "طلایی", emoji: "🥇", cls: "bg-yellow-100 text-yellow-700 ring-yellow-300" },
  platinum: { label: "پلاتینی", emoji: "💎", cls: "bg-indigo-100 text-indigo-700 ring-indigo-300" },
};

export function levelInfo(key?: string) {
  return (
    LEVEL_INFO[key ?? ""] ?? {
      label: key ?? "—", emoji: "⭐",
      cls: "bg-slate-100 text-slate-600 ring-slate-200",
    }
  );
}
