"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Sidebar } from "@/components/Sidebar";

type Student = {
  id: string;
  full_name: string | null;
  mobile: string;
  status: string;
};

export default function StudentsPage() {
  const { data } = useQuery({
    queryKey: ["students"],
    queryFn: async () => (await api.get("/students")).data,
  });

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <h1 className="mb-6 text-2xl font-bold">دانشجویان / سرنخ‌ها</h1>
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="p-3 text-right">نام</th>
                <th className="p-3 text-right">موبایل</th>
                <th className="p-3 text-right">وضعیت</th>
              </tr>
            </thead>
            <tbody>
              {(data?.items ?? []).map((s: Student) => (
                <tr key={s.id} className="border-t border-slate-100">
                  <td className="p-3">{s.full_name ?? "—"}</td>
                  <td className="p-3" dir="ltr">{s.mobile}</td>
                  <td className="p-3">{s.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
