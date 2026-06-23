"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { isDemoMode } from "@/lib/auth";
import { MessageSquare, Mail, Loader2 } from "lucide-react";

type Tab = "otp" | "password";
type OtpStep = "phone" | "code";

const DEMO = isDemoMode();

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("otp");

  function goDashboard() {
    router.push("/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 to-blue-50 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-lg">
        {/* لوگو */}
        <div className="mb-6 flex flex-col items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-xl font-extrabold text-white shadow-md">
            C
          </div>
          <h1 className="text-lg font-extrabold text-slate-800">ورود به CRM هوشمند</h1>
        </div>

        {/* تب‌ها */}
        <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
          <button
            onClick={() => setTab("otp")}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition ${
              tab === "otp" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"
            }`}
          >
            <MessageSquare size={15} /> ورود با پیامک
          </button>
          <button
            onClick={() => setTab("password")}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition ${
              tab === "password" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"
            }`}
          >
            <Mail size={15} /> ایمیل و رمز
          </button>
        </div>

        {tab === "otp" ? (
          <OtpForm onSuccess={goDashboard} />
        ) : (
          <PasswordForm onSuccess={goDashboard} />
        )}

        {DEMO && (
          <p className="mt-4 text-center text-xs text-amber-600">
            حالت نمایشی: ورود واقعی نیاز به اتصال بک‌اند دارد.
          </p>
        )}
      </div>
    </div>
  );
}

/* ---------- ورود با پیامک (دو مرحله: شماره → کد) ---------- */
function OtpForm({ onSuccess }: { onSuccess: () => void }) {
  const [step, setStep] = useState<OtpStep>("phone");
  const [mobile, setMobile] = useState("");
  const [code, setCode] = useState("");
  const [hint, setHint] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setHint(""); setLoading(true);
    try {
      if (DEMO) {
        // حالت دمو: بدون بک‌اند، کد ساختگی نمایش داده می‌شود
        setHint("کد نمایشی: ۱۲۳۴۵");
        setStep("code");
        return;
      }
      const { data } = await api.post("/auth/otp/request", { mobile });
      // در حالت تستی بک‌اند (console)، کد در پاسخ می‌آید
      if (data?.debug_code) setHint(`کد (تست): ${data.debug_code}`);
      setStep("code");
    } catch {
      setError("ارسال کد ناموفق بود. شماره را بررسی کنید.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      if (DEMO) {
        onSuccess();
        return;
      }
      const { data } = await api.post("/auth/otp/verify", { mobile, code });
      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("refresh_token", data.refresh_token);
      onSuccess();
    } catch {
      setError("کد واردشده نادرست است.");
    } finally {
      setLoading(false);
    }
  }

  if (step === "phone") {
    return (
      <form onSubmit={requestCode} className="space-y-3">
        <input
          type="tel"
          placeholder="شماره موبایل (مثلاً ۰۹۱۲۳۴۵۶۷۸۹)"
          value={mobile}
          onChange={(e) => setMobile(e.target.value)}
          className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          dir="ltr"
          required
        />
        {error && <div className="text-sm text-rose-600">{error}</div>}
        <button
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
        >
          {loading && <Loader2 size={16} className="animate-spin" />}
          دریافت کد
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={verifyCode} className="space-y-3">
      <div className="text-center text-xs text-slate-500">
        کد به شماره‌ی <span dir="ltr">{mobile}</span> ارسال شد
      </div>
      {hint && (
        <div className="rounded-lg bg-amber-50 py-1.5 text-center text-sm font-bold text-amber-700">
          {hint}
        </div>
      )}
      <input
        type="text"
        inputMode="numeric"
        placeholder="کد ۵ رقمی"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-center text-lg tracking-widest outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        dir="ltr"
        required
      />
      {error && <div className="text-sm text-rose-600">{error}</div>}
      <button
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
      >
        {loading && <Loader2 size={16} className="animate-spin" />}
        ورود
      </button>
      <button
        type="button"
        onClick={() => { setStep("phone"); setCode(""); setError(""); }}
        className="w-full text-center text-xs text-slate-400 hover:text-slate-600"
      >
        تغییر شماره
      </button>
    </form>
  );
}

/* ---------- ورود با ایمیل و رمز ---------- */
function PasswordForm({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      if (DEMO) {
        onSuccess();
        return;
      }
      const { data } = await api.post("/auth/login", { email, password });
      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("refresh_token", data.refresh_token);
      onSuccess();
    } catch {
      setError("ایمیل یا رمز عبور نادرست است");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <input
        type="email"
        placeholder="ایمیل"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        dir="ltr"
        required
      />
      <input
        type="password"
        placeholder="رمز عبور"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        dir="ltr"
        required
      />
      {error && <div className="text-sm text-rose-600">{error}</div>}
      <button
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
      >
        {loading && <Loader2 size={16} className="animate-spin" />}
        ورود
      </button>
    </form>
  );
}
