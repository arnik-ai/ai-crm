"use client";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { isDemoMode } from "@/lib/auth";
import { faNum } from "@/lib/utils";
import { J_MONTHS } from "@/lib/jalali";
import { Plus, X, Loader2, Trash2, CalendarClock } from "lucide-react";

const DEMO = isDemoMode();

type Plan = {
  id: string;
  student_name: string | null;
  mobile: string | null;
  advisor: string | null;
  amount: number;              // تومانِ کامل
  count: number;               // تعداد اقساط
  installment_amount: number;  // تومانِ کامل
  start_month: string | null;  // ماهِ شروع (شمسی)
  paid: number[];              // شماره‌اقساطِ پرداخت‌شده
};

/** نمایش مبلغ به «هزار تومان» (مطابق روالِ کارفرما). */
function amountFa(toman: number): string {
  return `${faNum(Math.round((toman || 0) / 1000))}`;
}

export function InstallmentsTab() {
  const qc = useQueryClient();
  const { data } = useQuery<{ items: Plan[] }>({
    queryKey: ["installments"],
    queryFn: async () => (await api.get("/installments")).data,
  });
  const items = data?.items ?? [];

  const [showAdd, setShowAdd] = useState(false);
  // override محلیِ paid برای فیدبکِ فوری (و کارکرد در دمو)
  const [overrides, setOverrides] = useState<Record<string, number[]>>({});

  function paidOf(p: Plan): number[] {
    return overrides[p.id] ?? p.paid ?? [];
  }

  async function toggle(p: Plan, n: number) {
    const cur = paidOf(p);
    const next = cur.includes(n) ? cur.filter((x) => x !== n) : [...cur, n].sort((a, b) => a - b);
    setOverrides((o) => ({ ...o, [p.id]: next }));
    if (!DEMO) {
      try {
        await api.post(`/installments/${p.id}/toggle/${n}`, {});
      } catch {
        // در صورت خطا، override را برمی‌گردانیم
        setOverrides((o) => ({ ...o, [p.id]: cur }));
      }
    }
  }

  async function remove(p: Plan) {
    if (!confirm(`ردیفِ «${p.student_name ?? "—"}» حذف شود؟`)) return;
    if (DEMO) return;
    try {
      await api.delete(`/installments/${p.id}`);
      qc.invalidateQueries({ queryKey: ["installments"] });
    } catch {
      alert("حذف ناموفق بود.");
    }
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm text-slate-300">
          <CalendarClock size={18} className="text-amber-400" />
          {faNum(items.length)} پلنِ اقساط
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-amber-700 active:scale-95"
        >
          <Plus size={16} /> افزودن ردیف
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-amber-100 bg-white shadow-sm">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-gradient-to-l from-amber-50 to-orange-50 text-slate-600">
            <tr>
              <th className="p-3 text-right font-medium">دانش‌آموز</th>
              <th className="p-3 text-right font-medium">مشاور</th>
              <th className="p-3 text-center font-medium">مبلغ</th>
              <th className="p-3 text-center font-medium">تعداد</th>
              <th className="p-3 text-center font-medium">قسط</th>
              <th className="p-3 text-center font-medium">شروع</th>
              <th className="p-3 text-center font-medium">اقساط (کلیک = پرداخت‌شده)</th>
              <th className="p-3 text-center font-medium">—</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p, i) => {
              const paid = paidOf(p);
              const startIdx = p.start_month ? Math.max(0, J_MONTHS.indexOf(p.start_month)) : 0;
              const cells = Array.from({ length: Math.min(p.count, 24) }, (_, k) => k + 1);
              return (
                <tr key={p.id} className={`border-t border-slate-100 ${i % 2 === 1 ? "bg-slate-50/40" : ""}`}>
                  <td className="p-3">
                    <div className="font-medium text-slate-700">{p.student_name ?? "—"}</div>
                    {p.mobile && <div className="text-xs text-slate-400" dir="ltr">{p.mobile}</div>}
                  </td>
                  <td className="p-3 text-slate-600">{p.advisor ?? "—"}</td>
                  <td className="p-3 text-center font-bold text-emerald-600">{amountFa(p.amount)}</td>
                  <td className="p-3 text-center text-slate-600">{faNum(p.count)}</td>
                  <td className="p-3 text-center text-slate-600">{amountFa(p.installment_amount)}</td>
                  <td className="p-3 text-center text-slate-500">{p.start_month ?? "—"}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap justify-center gap-1">
                      {cells.map((n) => {
                        const isPaid = paid.includes(n);
                        const monthName = J_MONTHS[(startIdx + n - 1) % 12];
                        return (
                          <button
                            key={n}
                            type="button"
                            onClick={() => toggle(p, n)}
                            title={`قسط ${faNum(n)} · ${monthName}`}
                            className={`flex h-9 w-12 flex-col items-center justify-center rounded-lg border text-[10px] leading-tight transition ${
                              isPaid
                                ? "border-emerald-300 bg-emerald-500 text-white"
                                : "border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100"
                            }`}
                          >
                            <span>{monthName}</span>
                            <span className="font-bold">{isPaid ? "✓" : faNum(n)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </td>
                  <td className="p-3 text-center">
                    <button onClick={() => remove(p)} title="حذف ردیف"
                      className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-500">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {items.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-slate-400">
            <CalendarClock size={40} className="opacity-40" />
            <p className="text-sm">هنوز پلنِ اقساطی ثبت نشده — «افزودن ردیف» را بزنید.</p>
          </div>
        )}
      </div>

      {showAdd && (
        <AddPlanModal
          onClose={() => setShowAdd(false)}
          onAdded={() => { setShowAdd(false); qc.invalidateQueries({ queryKey: ["installments"] }); }}
        />
      )}
    </div>
  );
}

/* ---------- مودال افزودن ردیفِ اقساط ---------- */
function AddPlanModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const { data: meta } = useQuery<{ months: string[] }>({
    queryKey: ["installments-meta"],
    queryFn: async () => (await api.get("/installments/meta")).data,
  });
  const months = meta?.months ?? J_MONTHS;

  const [studentName, setStudentName] = useState("");
  const [mobile, setMobile] = useState("");
  const [advisor, setAdvisor] = useState("");
  const [amount, setAmount] = useState("");
  const [count, setCount] = useState("");
  const [inst, setInst] = useState("");
  const [startMonth, setStartMonth] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (studentName.trim().length < 2) { setError("نام دانش‌آموز را وارد کنید."); return; }
    if (!count || Number(count) < 1) { setError("تعداد اقساط را وارد کنید."); return; }
    setLoading(true);
    try {
      if (DEMO) { alert("در حالت نمایشی، ذخیره نمی‌شود."); onClose(); return; }
      await api.post("/installments", {
        student_name: studentName,
        mobile: mobile || null,
        advisor: advisor || null,
        amount: (Number(amount) || 0) * 1000,            // هزار تومان → تومان
        count: Number(count) || 1,
        installment_amount: (Number(inst) || 0) * 1000,  // هزار تومان → تومان
        start_month: startMonth || null,
      });
      onAdded();
    } catch {
      setError("ثبت ناموفق بود.");
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-bold text-slate-800">افزودن پلنِ اقساط</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <input value={studentName} onChange={(e) => setStudentName(e.target.value)} placeholder="نام و نام خانوادگی"
            className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-amber-400" required />
          <div className="grid grid-cols-2 gap-3">
            <input value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="موبایل (اختیاری)" dir="ltr"
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-amber-400" />
            <input value={advisor} onChange={(e) => setAdvisor(e.target.value)} placeholder="مشاور"
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-amber-400" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min={0} dir="ltr" placeholder="مبلغ کل"
              className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-amber-400" />
            <input value={count} onChange={(e) => setCount(e.target.value)} type="number" min={1} max={24} dir="ltr" placeholder="تعداد قسط"
              className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-amber-400" required />
            <input value={inst} onChange={(e) => setInst(e.target.value)} type="number" min={0} dir="ltr" placeholder="مبلغ قسط"
              className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-amber-400" />
          </div>
          <p className="text-xs text-slate-400">مبلغ‌ها به «هزار تومان» (سه صفر آخر را نزنید).</p>
          <select value={startMonth} onChange={(e) => setStartMonth(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-amber-400">
            <option value="">ماهِ شروع…</option>
            {months.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          {error && <div className="text-sm text-rose-600">{error}</div>}
          <button disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 py-2.5 font-medium text-white transition hover:bg-amber-700 disabled:opacity-60">
            {loading && <Loader2 size={16} className="animate-spin" />} ثبت ردیف
          </button>
        </form>
      </div>
    </div>
  );
}
