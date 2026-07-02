"use client";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { isDemoMode } from "@/lib/auth";
import { Sidebar } from "@/components/Sidebar";
import { BackButton } from "@/components/BackButton";
import { CallButton } from "@/components/CallButton";
import { Pagination } from "@/components/Pagination";
import { ExportButton } from "@/components/ExportButton";
import { ExportAllButton } from "@/components/ExportAllButton";
import { useToast } from "@/components/Toast";
import type { ExcelColumn } from "@/lib/exportExcel";
import { faNum, faDateTime } from "@/lib/utils";
import { Search, CalendarClock, CalendarCheck, ListTodo, Check, Trash2, Loader2 } from "lucide-react";

const DEMO = isDemoMode();

/**
 * شکل خامِ پیگیری از سرور؛ دو حالت پشتیبانی می‌شود:
 * - دمو: { date, next_call (تاریخ شمسی رشته‌ای), student_name, mobile, note }
 * - بک واقعی: { due_at/next_call (ISO)، student_name، mobile، status، note }
 */
type RawFollowup = {
  id: string;
  date?: string;
  due_at?: string;
  next_call?: string;
  student_name?: string | null;
  mobile?: string | null;
  status?: string;
  note?: string | null;
};

type Followup = {
  id: string;
  registered: string; // تاریخ ثبت (نمایش)
  nextCall: string; // تاریخ تماس بعدی (نمایش)
  sortKey: string; // کلید مرتب‌سازی
  student_name: string;
  mobile: string;
  note: string;
};

type FollowupsResponse = {
  items: RawFollowup[];
  total?: number;
  page?: number;
  size?: number;
};

const PAGE_SIZE = 20;

// ستون‌های خروجی اکسل پیگیری‌ها (از مقادیر نمایش‌داده‌شده)
const EXCEL_COLUMNS: ExcelColumn<Followup>[] = [
  { key: "student_name", label: "نام دانشجو" },
  { key: "mobile", label: "موبایل" },
  { key: "registered", label: "تاریخ ثبت" },
  { key: "nextCall", label: "تماس بعدی" },
  { key: "note", label: "توضیحات" },
];

/** آیا رشته یک تاریخ ISO است (مثلاً 2026-06-21T...)؟ */
function isIso(s?: string): boolean {
  return !!s && /^\d{4}-\d{2}-\d{2}T/.test(s);
}

/** نمایش تاریخ: ISO → فارسی خوانا؛ شمسیِ رشته‌ای → همان. */
function showDate(s?: string): string {
  if (!s) return "—";
  return isIso(s) ? faDateTime(s) : s;
}

/** نرمال‌سازی هر دو شکل سرور به یک ساختار واحد. */
function normalize(r: RawFollowup): Followup {
  const next = r.next_call ?? r.due_at ?? "";
  return {
    id: r.id,
    registered: showDate(r.date ?? r.due_at),
    nextCall: showDate(next),
    sortKey: next,
    student_name: r.student_name ?? "—",
    mobile: r.mobile ?? "",
    note: r.note ?? "",
  };
}

export default function FollowupsPage() {
  const [page, setPage] = useState(1);
  const { data } = useQuery<FollowupsResponse>({
    queryKey: ["followups", page],
    queryFn: async () =>
      (await api.get(`/followups?page=${page}&size=${PAGE_SIZE}`)).data,
    placeholderData: (prev) => prev,
  });

  const [q, setQ] = useState("");

  const items: Followup[] = useMemo(() => {
    let list: Followup[] = (data?.items ?? []).map(normalize);
    if (q.trim()) {
      const k = q.trim();
      list = list.filter(
        (f) => f.student_name.includes(k) || f.mobile.includes(k) || f.note.includes(k)
      );
    }
    // مرتب‌سازی بر اساس تاریخ تماس بعدی (نزدیک‌ترین اول)
    return [...list].sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }, [data, q]);

  const total = data?.items?.length ?? 0;

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar />
      <main className="flex-1 p-4 md:p-8">
        {/* سرتیتر */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-200">
              <ListTodo size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-white">پیگیری‌ها</h1>
              <p className="mt-0.5 text-sm text-slate-300">
                {faNum(items.length)} مورد · مرتب‌شده بر اساس تماس بعدی
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ExportButton rows={items} columns={EXCEL_COLUMNS} filename="پیگیری‌ها" />
            <ExportAllButton endpoint="/followups/export" filename="همه-پیگیری‌ها" />
            <BackButton dark />
          </div>
        </div>

        {/* کارت‌های خلاصه */}
        <div className="mb-4 grid grid-cols-2 gap-3">
          <div className="flex items-center gap-3 rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
            <CalendarClock className="text-blue-500" size={26} />
            <div>
              <div className="text-2xl font-extrabold text-slate-800">{faNum(total)}</div>
              <div className="text-xs text-slate-500">کل پیگیری‌ها</div>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
            <CalendarCheck className="text-emerald-500" size={26} />
            <div>
              <div className="text-2xl font-extrabold text-slate-800">{faNum(items.length)}</div>
              <div className="text-xs text-slate-500">نمایش‌داده‌شده</div>
            </div>
          </div>
        </div>

        {/* نوار جستجو */}
        <div className="panel-toolbar mb-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 sm:max-w-xs">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="جستجوی نام، موبایل یا یادداشت…"
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-9 pl-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>

        {/* جدول پیگیری‌ها */}
        <div className="overflow-x-auto rounded-2xl border border-indigo-100 bg-white shadow-sm">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-gradient-to-l from-sky-50 to-indigo-50 text-slate-600">
              <tr>
                <th className="p-3.5 text-right font-medium">دانشجو</th>
                <th className="p-3.5 text-right font-medium">تاریخ ثبت</th>
                <th className="p-3.5 text-right font-medium">تماس بعدی</th>
                <th className="p-3.5 text-right font-medium">یادداشت</th>
                <th className="p-3.5 text-center font-medium">اقدام</th>
              </tr>
            </thead>
            <tbody>
              {items.map((f, i) => (
                <tr
                  key={f.id}
                  className={`border-t border-slate-100 transition hover:bg-indigo-50/60 ${
                    i % 2 === 1 ? "bg-slate-50/40" : ""
                  }`}
                >
                  <td className="p-3.5">
                    <div className="font-medium text-slate-700">{f.student_name}</div>
                    <div className="text-xs text-slate-400" dir="ltr">{f.mobile || "—"}</div>
                  </td>
                  <td className="p-3.5 text-slate-600">{f.registered}</td>
                  <td className="p-3.5">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-600">
                      <CalendarClock size={12} /> {f.nextCall}
                    </span>
                  </td>
                  <td className="p-3.5 text-slate-500">{f.note || "—"}</td>
                  <td className="p-3.5">
                    <FollowupActions id={f.id} mobile={f.mobile} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* حالت خالی */}
          {items.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-slate-400">
              <ListTodo size={40} className="opacity-40" />
              <p className="text-sm">پیگیری‌ای مطابق جستجوی شما یافت نشد.</p>
            </div>
          )}
        </div>

        {/* صفحه‌بندی — فقط در نمای کامل (جستجو سمت‌سرور نیست). */}
        {q.trim() === "" && (
          <Pagination
            page={data?.page ?? page}
            size={data?.size ?? PAGE_SIZE}
            total={data?.total ?? total}
            onPage={setPage}
          />
        )}
      </main>
    </div>
  );
}

/* ---------- اقدام‌های پیگیری: تماس · انجام‌شد · حذف ---------- */
function FollowupActions({ id, mobile }: { id: string; mobile: string }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function done() {
    if (DEMO) { alert("در حالت نمایشی ذخیره نمی‌شود."); return; }
    setBusy(true);
    try {
      await api.post(`/followups/${id}/done`);
      qc.invalidateQueries({ queryKey: ["followups"] });
      qc.invalidateQueries({ queryKey: ["tasks-today"] });
      toast("پیگیری انجام شد ✓");
    } catch { alert("ثبت ناموفق بود."); setBusy(false); }
  }

  async function remove() {
    if (!confirm("این پیگیری حذف شود؟")) return;
    if (DEMO) { alert("در حالت نمایشی حذف نمی‌شود."); return; }
    setBusy(true);
    try {
      await api.delete(`/followups/${id}`);
      qc.invalidateQueries({ queryKey: ["followups"] });
      qc.invalidateQueries({ queryKey: ["tasks-today"] });
      toast("پیگیری حذف شد ✓");
    } catch { alert("حذف ناموفق بود."); setBusy(false); }
  }

  return (
    <div className="flex items-center justify-center gap-2">
      {mobile ? <CallButton mobile={mobile} size="sm" /> : null}
      <button
        onClick={done}
        disabled={busy}
        title="انجام شد"
        className="inline-flex items-center justify-center rounded-lg bg-emerald-50 p-1.5 text-emerald-600 transition hover:bg-emerald-100 disabled:opacity-50"
      >
        <Check size={16} />
      </button>
      <button
        onClick={remove}
        disabled={busy}
        title="حذف پیگیری"
        className="inline-flex items-center justify-center rounded-lg bg-rose-50 p-1.5 text-rose-600 transition hover:bg-rose-100 disabled:opacity-50"
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
      </button>
    </div>
  );
}
