import { Sidebar } from "@/components/Sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // روی موبایل، به‌جای اسکرولِ «بدنه»، «main» اسکرول می‌شود تا نوارِ داینامیکِ Safari
  // باز/بسته نشود و نوارِ پایین (BottomNav با position:fixed) هنگامِ اسکرول نپرد.
  // روی دسکتاپ (md) رفتار عادیِ قبلی حفظ می‌شود (بدنه اسکرول، بدونِ ارتفاعِ ثابت).
  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden md:h-auto md:min-h-screen md:flex-row md:overflow-visible">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-4 pb-24 md:overflow-visible md:p-8 md:pb-8">
        {children}
      </main>
    </div>
  );
}
