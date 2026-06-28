"use client";
import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronRight, ChevronLeft, X } from "lucide-react";
import {
  J_MONTHS, J_WEEKDAYS, daysInJMonth, firstWeekdayOfJMonth,
  isoToJalali, jalaliToIso, todayJalali,
} from "@/lib/jalali";
import { faNum, faDate } from "@/lib/utils";

/** تقویم‌نمای شمسی — مقدار به‌صورت ISO میلادی ("YYYY-MM-DD") ذخیره/ارسال می‌شود،
 *  ولی نمایش و انتخاب کاملاً شمسی است (هم‌راستا با قانونِ «تاریخ همیشه شمسی»).
 *
 *  چرا ISO خروجی می‌دهد: بک‌اند با تاریخِ میلادی کار می‌کند؛ تبدیل اینجا انجام می‌شود.
 */
export function JalaliDatePicker({
  value, onChange, placeholder = "انتخاب تاریخ",
}: {
  value: string;            // ISO میلادی یا ""
  onChange: (iso: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // ماهی که در تقویم نمایش داده می‌شود (شمسی) — از روی مقدار یا امروز
  const sel = isoToJalali(value);
  const init = sel ?? todayJalali();
  const [viewY, setViewY] = useState(init.jy);
  const [viewM, setViewM] = useState(init.jm);

  // با باز شدن، نمای تقویم را روی ماهِ مقدارِ فعلی (یا امروز) ببر
  useEffect(() => {
    if (open) {
      const s = isoToJalali(value) ?? todayJalali();
      setViewY(s.jy);
      setViewM(s.jm);
    }
  }, [open, value]);

  // بستن با کلیک بیرون
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function prevMonth() {
    setViewM((m) => (m === 1 ? 12 : m - 1));
    setViewY((y) => (viewM === 1 ? y - 1 : y));
  }
  function nextMonth() {
    setViewM((m) => (m === 12 ? 1 : m + 1));
    setViewY((y) => (viewM === 12 ? y + 1 : y));
  }
  function pick(jd: number) {
    onChange(jalaliToIso(viewY, viewM, jd));
    setOpen(false);
  }

  const today = todayJalali();
  const lead = firstWeekdayOfJMonth(viewY, viewM); // خانه‌های خالی ابتدای ماه
  const days = daysInJMonth(viewY, viewM);
  const cells: (number | null)[] = [
    ...Array(lead).fill(null),
    ...Array.from({ length: days }, (_, i) => i + 1),
  ];

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none transition hover:border-violet-400 focus:border-violet-400"
      >
        <CalendarDays size={15} className="text-slate-400" />
        <span className={value ? "" : "text-slate-400"}>
          {value ? faDate(value) : placeholder}
        </span>
        {value && (
          <X
            size={14}
            className="text-slate-300 transition hover:text-rose-500"
            onClick={(e) => { e.stopPropagation(); onChange(""); }}
          />
        )}
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
          {/* سرتیتر: ماه/سال + ناوبری */}
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={prevMonth}
              className="rounded-lg p-1 text-slate-500 hover:bg-slate-100">
              <ChevronRight size={18} />
            </button>
            <div className="text-sm font-bold text-slate-700">
              {J_MONTHS[viewM - 1]} {faNum(viewY)}
            </div>
            <button type="button" onClick={nextMonth}
              className="rounded-lg p-1 text-slate-500 hover:bg-slate-100">
              <ChevronLeft size={18} />
            </button>
          </div>

          {/* نام روزهای هفته */}
          <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[11px] text-slate-400">
            {J_WEEKDAYS.map((w) => (
              <div key={w}>{w}</div>
            ))}
          </div>

          {/* روزها */}
          <div className="grid grid-cols-7 gap-1">
            {cells.map((d, i) => {
              if (d === null) return <div key={`e${i}`} />;
              const isSel = sel && sel.jy === viewY && sel.jm === viewM && sel.jd === d;
              const isToday =
                today.jy === viewY && today.jm === viewM && today.jd === d;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => pick(d)}
                  className={`h-8 rounded-lg text-sm transition ${
                    isSel
                      ? "bg-violet-600 font-bold text-white"
                      : isToday
                      ? "bg-violet-50 font-bold text-violet-600"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {faNum(d)}
                </button>
              );
            })}
          </div>

          {/* میان‌بر امروز */}
          <div className="mt-2 flex justify-between border-t border-slate-100 pt-2">
            <button
              type="button"
              onClick={() => { onChange(""); setOpen(false); }}
              className="text-xs text-slate-400 hover:text-rose-500"
            >
              پاک کردن
            </button>
            <button
              type="button"
              onClick={() => {
                onChange(jalaliToIso(today.jy, today.jm, today.jd));
                setOpen(false);
              }}
              className="text-xs font-medium text-violet-600 hover:text-violet-700"
            >
              امروز
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
