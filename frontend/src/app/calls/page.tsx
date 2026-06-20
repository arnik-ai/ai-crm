"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Sidebar } from "@/components/Sidebar";

export default function CallsPage() {
  const { data } = useQuery({
    queryKey: ["calls"],
    queryFn: async () => (await api.get("/calls")).data,
  });

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <h1 className="mb-6 text-2xl font-bold">تماس‌ها</h1>
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="p-3 text-right">جهت</th>
                <th className="p-3 text-right">شماره</th>
                <th className="p-3 text-right">مدت</th>
                <th className="p-3 text-right">امتیاز سرنخ</th>
              </tr>
            </thead>
            <tbody>
              {(data?.items ?? []).map((c: any) => (
                <tr key={c.id} className="border-t border-slate-100">
                  <td className="p-3">
                    {c.direction === "inbound" ? "ورودی" : "خروجی"}
                  </td>
                  <td className="p-3" dir="ltr">{c.caller_number}</td>
                  <td className="p-3">{c.duration_sec}s</td>
                  <td className="p-3">{c.lead_score ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
