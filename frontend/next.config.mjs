/** @type {import('next').NextConfig} */

// روی گیت‌هاب با NEXT_OUTPUT=export خروجی استاتیک برای GitHub Pages ساخته می‌شود.
const isStaticExport = process.env.NEXT_OUTPUT === "export";

const nextConfig = {
  reactStrictMode: true,
  output: isStaticExport ? "export" : undefined,
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",
  images: isStaticExport ? { unoptimized: true } : undefined,
  // فقط در حالت غیر-استاتیک (لوکال) درخواست‌های API به بک‌اند پراکسی می‌شوند.
  // در خروجی استاتیک (GitHub Pages) سرور پراکسی وجود ندارد و حالت دمو داده می‌دهد.
  ...(isStaticExport
    ? {}
    : {
        async rewrites() {
          return [
            {
              source: "/api/:path*",
              destination: `${process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000"}/api/:path*`,
            },
          ];
        },
      }),
};

export default nextConfig;
