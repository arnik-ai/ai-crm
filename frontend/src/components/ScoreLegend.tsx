/**
 * راهنمای رنگِ امتیاز سرنخ — تا کاربر معنی رنگ‌ها (داغ/گرم/سرد) را بداند.
 */
const items = [
  {
    dot: "bg-emerald-500",
    label: "داغ",
    range: "۷۰ به بالا",
    desc: "احتمال ثبت‌نام بالا — همین الان پیگیری کن",
    box: "bg-emerald-50 text-emerald-700",
  },
  {
    dot: "bg-amber-500",
    label: "گرم",
    range: "۴۰ تا ۶۹",
    desc: "علاقه‌مند ولی مردد — با مشاوره جذب می‌شود",
    box: "bg-amber-50 text-amber-700",
  },
  {
    dot: "bg-blue-500",
    label: "سرد",
    range: "زیر ۴۰",
    desc: "علاقه‌ی کم — اولویت پایین",
    box: "bg-blue-50 text-blue-700",
  },
];

export function ScoreLegend() {
  return (
    <div className="mb-5 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
        راهنمای امتیاز سرنخ
        <span className="text-xs font-normal text-slate-400">
          (نمره‌ی هوش مصنوعی به احتمال ثبت‌نام)
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {items.map((it) => (
          <div key={it.label} className={`rounded-xl p-3 ${it.box}`}>
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${it.dot}`} />
              <span className="font-bold">سرنخ {it.label}</span>
              <span className="mr-auto text-xs opacity-70">{it.range}</span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed opacity-90">{it.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
