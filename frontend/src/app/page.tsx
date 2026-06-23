import { redirect } from "next/navigation";

export default function Home() {
  // صفحه‌ی اصلی = کارهای روزِ نیرو
  redirect("/tasks");
}
