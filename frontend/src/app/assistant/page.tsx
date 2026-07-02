"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import { Sidebar } from "@/components/Sidebar";
import { BackButton } from "@/components/BackButton";
import { Bot, Send } from "lucide-react";

const samples = [
  "امروز با چه کسانی تماس بگیرم؟",
  "کدام دانشجوها احتمال ثبت‌نام بالایی دارند؟",
  "دانشجوهای علاقه‌مند به پایتون را نشان بده",
  "سرنخ‌های دارای اعتراض قیمتی",
  "سرنخ‌های بدون پیگیری در ۷ روز اخیر",
];

type Msg = { role: "user" | "assistant"; text: string; students?: any[] };

export default function AssistantPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function send(text: string) {
    if (!text.trim()) return;
    setMessages((m) => [...m, { role: "user", text }]);
    setInput("");
    setLoading(true);
    try {
      const { data } = await api.post("/ai/assistant/query", { message: text });
      setMessages((m) => [
        ...m,
        { role: "assistant", text: data.answer, students: data.students },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    // روی موبایل ارتفاعِ ثابت + اسکرولِ داخلی تا ورودی همیشه بالای نوارِ پایین بماند
    // و زیرِ آن گیر نکند. روی دسکتاپ رفتار عادی.
    <div className="flex h-[100dvh] flex-col overflow-hidden md:h-auto md:min-h-screen md:flex-row md:overflow-visible">
      <Sidebar />
      <main className="flex min-h-0 flex-1 flex-col p-4 pb-24 md:p-8 md:pb-8">
        <div className="mb-6 flex shrink-0 items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-500 text-white shadow-md shadow-violet-200">
              <Bot size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-white">دستیار هوشمند CRM</h1>
              <p className="mt-0.5 text-sm text-slate-300">سؤالت را بپرس تا از بین سرنخ‌ها برایت پیدا کنم</p>
            </div>
          </div>
          <BackButton dark />
        </div>

        <div className="mb-4 flex shrink-0 flex-wrap gap-2">
          {samples.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-sm text-white backdrop-blur-sm transition hover:bg-white/20"
            >
              {s}
            </button>
          ))}
        </div>

        <div className="card mb-3 min-h-0 flex-1 space-y-4 overflow-y-auto">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`max-w-[80%] rounded-xl p-3 text-sm ${
                m.role === "user"
                  ? "ms-auto bg-brand text-white"
                  : "bg-slate-100 text-slate-800"
              }`}
            >
              <div>{m.text}</div>
              {m.students && m.students.length > 0 && (
                <ul className="mt-2 list-disc ps-5">
                  {m.students.map((st) => (
                    <li key={st.id}>
                      {st.full_name ?? st.mobile}
                      {st.registration_probability != null &&
                        ` — احتمال: ${Math.round(
                          st.registration_probability * 100
                        )}%`}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
          {loading && <div className="text-sm text-slate-400">در حال پردازش…</div>}
          {messages.length === 0 && !loading && (
            <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-2 text-slate-300">
              <Bot size={40} className="opacity-40" />
              <p className="text-sm">یکی از سؤال‌های بالا را بزن یا خودت بنویس.</p>
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex shrink-0 gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="سؤال خود را بنویسید…"
            className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
          />
          <button
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-l from-violet-500 to-purple-500 px-5 py-2.5 font-medium text-white shadow-md shadow-violet-200 transition hover:opacity-90"
            type="submit"
          >
            <Send size={16} /> ارسال
          </button>
        </form>
      </main>
    </div>
  );
}
