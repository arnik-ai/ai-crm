"use client";
import { useState } from "react";
import { MessageSquare, X, Loader2, Send } from "lucide-react";
import { api, apiErrorMessage } from "@/lib/api";
import { isDemoMode } from "@/lib/auth";

const DEMO = isDemoMode();

/** کانال‌های پیام. sms واقعاً از سرور ارسال می‌شود (اگر سامانه‌ی پیامکی وصل باشد)؛
 *  واتساپ/تلگرام/بله از سمتِ کلاینت باز می‌شوند و فقط ثبت می‌شوند. */
const MSG_CHANNELS = [
  { v: "sms", label: "پیامک سامانه‌ای" },
  { v: "whatsapp", label: "واتساپ" },
  { v: "telegram", label: "تلگرام" },
  { v: "bale", label: "بله" },
];

/** شماره به ارقام بین‌المللی بدون + (۰ ابتدایی → ۹۸) برای لینک پیام‌رسان. */
function toIntl(mobile: string): string {
  let d = mobile.replace(/\D/g, "");
  if (d.startsWith("0")) d = "98" + d.slice(1);
  return d;
}

type MsgStudent = { id: string; full_name: string | null; mobile: string };

/**
 * مودالِ مشترکِ ارسال پیام (پیامک/واتساپ/تلگرام/بله) با متنِ آزاد.
 *
 * - پیامک: اگر سامانه‌ی پیامکی در بک‌اند وصل باشد واقعاً ارسال می‌شود؛ وگرنه فقط ثبت.
 * - واتساپ: لینکِ wa.me با متنِ آماده باز می‌شود.
 * - تلگرام: پنجره‌ی share تلگرام با متنِ آماده.
 * - بله: چون لینکِ مستقیمِ «چت با شماره + متن» ندارد، متن در کلیپ‌بورد کپی و وبِ بله
 *   باز می‌شود تا کاربر پیست کند.
 * در همه‌ی حالت‌ها پیام در سرور ثبت می‌شود (برای «گزارش ارتباطات»).
 */
export function MessageModal({
  student,
  onClose,
}: {
  student: MsgStudent;
  onClose: () => void;
}) {
  const [channel, setChannel] = useState("sms");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) {
      setMsg("متن پیام را بنویسید.");
      return;
    }
    setMsg("");
    setLoading(true);
    try {
      // ثبت پیام در سرور (در دمو ذخیره نمی‌شود)
      if (!DEMO) {
        await api.post("/messages", {
          mobile: student.mobile, channel, body: text,
          student_id: student.id,
        });
      }
      const intl = toIntl(student.mobile);
      if (channel === "whatsapp") {
        window.open(`https://wa.me/${intl}?text=${encodeURIComponent(text)}`, "_blank");
      } else if (channel === "telegram") {
        window.open(`https://t.me/share/url?url=&text=${encodeURIComponent(text)}`, "_blank");
      } else if (channel === "bale") {
        // بله لینکِ «چت با شماره + متن» ندارد → متن را کپی و وبِ بله را باز می‌کنیم.
        try { await navigator.clipboard.writeText(text); } catch { /* بی‌صدا */ }
        window.open("https://web.bale.ai", "_blank");
      }
      if (channel === "bale") {
        setMsg("متن کپی شد؛ در بله برای این شماره پیست کن.");
      } else {
        setMsg(DEMO ? "در حالت نمایشی ثبت نشد (پیام‌رسان باز شد)." : "پیام ثبت شد ✓");
      }
      if (!DEMO && channel === "sms") onClose();
    } catch (err) {
      setMsg(apiErrorMessage(err, "ارسال ناموفق بود."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-bold text-slate-800">
            <MessageSquare size={18} className="text-violet-600" /> ارسال پیام
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={18} />
          </button>
        </div>

        <p className="mb-4 text-sm text-slate-500">
          {student.full_name ?? "ناشناس"} · <span dir="ltr">{student.mobile}</span>
        </p>

        <form onSubmit={submit} className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {MSG_CHANNELS.map((c) => (
              <button
                key={c.v}
                type="button"
                onClick={() => setChannel(c.v)}
                className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                  channel === c.v
                    ? "bg-violet-500 text-white shadow-sm shadow-violet-200"
                    : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* راهنمای پیامکِ سامانه‌ای (نیاز به اتصالِ سامانه‌ی پیامکی) */}
          {channel === "sms" && (
            <p className="text-xs text-slate-400">
              پیامکِ سامانه‌ای فقط وقتی واقعاً ارسال می‌شود که سامانه‌ی پیامکی به بک‌اند وصل باشد؛
              در غیر این‌صورت فقط ثبت می‌شود.
            </p>
          )}

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            placeholder="متن پیام را آزادانه بنویسید…"
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-violet-400"
          />

          <div className="flex items-center justify-end gap-2">
            {msg && <span className="mr-auto text-xs text-slate-500">{msg}</span>}
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
            >
              بستن
            </button>
            <button
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-700 disabled:opacity-60"
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              {channel === "sms" ? "ارسال پیامک" : "باز کردن و ثبت"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
