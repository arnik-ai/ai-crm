"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Sidebar } from "@/components/Sidebar";
import { BackButton } from "@/components/BackButton";
import { isDemoMode } from "@/lib/auth";
import { UserCog, UserPlus, ShieldCheck, Loader2, X, Power } from "lucide-react";

type User = {
  id: string;
  full_name: string;
  mobile: string | null;
  email: string;
  is_active: boolean;
  roles: string[];
};

const DEMO = isDemoMode();

const ROLE_LABEL: Record<string, string> = {
  admin: "مدیر سیستم",
  sales_manager: "مدیر فروش",
  sales_agent: "کارشناس فروش",
  viewer: "فقط مشاهده",
};
const ROLE_TONE: Record<string, string> = {
  admin: "bg-violet-50 text-violet-700",
  sales_manager: "bg-blue-50 text-blue-700",
  sales_agent: "bg-emerald-50 text-emerald-700",
  viewer: "bg-slate-100 text-slate-600",
};

function RoleBadge({ role }: { role: string }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${ROLE_TONE[role] ?? "bg-slate-100 text-slate-600"}`}>
      {ROLE_LABEL[role] ?? role}
    </span>
  );
}

export default function UsersPage() {
  const qc = useQueryClient();
  const { data } = useQuery<User[]>({
    queryKey: ["users"],
    queryFn: async () => (await api.get("/users")).data,
  });
  const [showAdd, setShowAdd] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const users: User[] = data ?? [];

  async function toggleActive(u: User) {
    if (DEMO) {
      alert("در حالت نمایشی، تغییرات ذخیره نمی‌شود.");
      return;
    }
    setBusy(u.id);
    try {
      await api.post(`/users/${u.id}/${u.is_active ? "deactivate" : "activate"}`);
      qc.invalidateQueries({ queryKey: ["users"] });
    } catch {
      alert("عملیات ناموفق بود.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar />
      <main className="flex-1 p-4 md:p-8">
        {/* سرتیتر */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-md shadow-violet-200">
              <UserCog size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-white">مدیریت کاربران</h1>
              <p className="mt-0.5 text-sm text-slate-300">{users.length} کاربر · اعضای تیم فروش</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAdd(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-violet-700 active:scale-95"
            >
              <UserPlus size={16} /> افزودن کاربر
            </button>
            <BackButton dark />
          </div>
        </div>

        {/* جدول کاربران */}
        <div className="overflow-x-auto rounded-2xl border border-violet-100 bg-white shadow-sm">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="bg-gradient-to-l from-violet-50 to-purple-50 text-slate-600">
              <tr>
                <th className="p-3.5 text-right font-medium">نام</th>
                <th className="p-3.5 text-right font-medium">موبایل</th>
                <th className="p-3.5 text-right font-medium">نقش</th>
                <th className="p-3.5 text-center font-medium">وضعیت</th>
                <th className="p-3.5 text-center font-medium">اقدام</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr key={u.id} className={`border-t border-slate-100 ${i % 2 === 1 ? "bg-slate-50/40" : ""}`}>
                  <td className="p-3.5 font-medium text-slate-700">{u.full_name}</td>
                  <td className="p-3.5 text-slate-500" dir="ltr">{u.mobile || "—"}</td>
                  <td className="p-3.5">{u.roles.map((r) => <RoleBadge key={r} role={r} />)}</td>
                  <td className="p-3.5 text-center">
                    {u.is_active ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                        <ShieldCheck size={12} /> فعال
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-600">غیرفعال</span>
                    )}
                  </td>
                  <td className="p-3.5 text-center">
                    <button
                      onClick={() => toggleActive(u)}
                      disabled={busy === u.id}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                      title={u.is_active ? "غیرفعال‌کردن" : "فعال‌کردن"}
                    >
                      {busy === u.id ? <Loader2 size={13} className="animate-spin" /> : <Power size={13} />}
                      {u.is_active ? "غیرفعال" : "فعال"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-slate-400">
              <UserCog size={40} className="opacity-40" />
              <p className="text-sm">هنوز کاربری ثبت نشده است.</p>
            </div>
          )}
        </div>
      </main>

      {showAdd && (
        <AddUserModal
          onClose={() => setShowAdd(false)}
          onAdded={() => { setShowAdd(false); qc.invalidateQueries({ queryKey: ["users"] }); }}
        />
      )}
    </div>
  );
}

/* ---------- مودال افزودن کاربر ---------- */
function AddUserModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  const [role, setRole] = useState("sales_agent");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      if (DEMO) {
        alert("در حالت نمایشی، افزودن کاربر ذخیره نمی‌شود.");
        onClose();
        return;
      }
      await api.post("/users", { full_name: fullName, mobile, role });
      onAdded();
    } catch {
      setError("ثبت ناموفق بود. شاید موبایل تکراری است.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-bold text-slate-800">افزودن کاربر جدید</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <input
            placeholder="نام و نام خانوادگی"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
            required
          />
          <input
            type="tel"
            placeholder="موبایل (مثلاً ۰۹۱۲۳۴۵۶۷۸۹)"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
            dir="ltr"
            required
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
          >
            <option value="sales_agent">کارشناس فروش</option>
            <option value="sales_manager">مدیر فروش</option>
            <option value="viewer">فقط مشاهده</option>
            <option value="admin">مدیر سیستم</option>
          </select>
          <p className="text-xs text-slate-400">
            کاربر با همین موبایل و کد پیامکی وارد می‌شود (نیازی به رمز نیست).
          </p>
          {error && <div className="text-sm text-rose-600">{error}</div>}
          <button
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-2.5 font-medium text-white transition hover:bg-violet-700 disabled:opacity-60"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            ثبت کاربر
          </button>
        </form>
      </div>
    </div>
  );
}
