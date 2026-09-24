import type { Metadata } from "next";
import { Vazirmatn } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/components/providers/query-provider";

// Vazirmatn is fetched and self-hosted by next/font at build time (no runtime
// request to Google). The variable feeds --font-vazirmatn used across the app.
const vazirmatn = Vazirmatn({
  subsets: ["arabic"],
  variable: "--font-vazirmatn",
  display: "swap",
});

export const metadata: Metadata = {
  title: "سامانه عملیات کامیاب",
  description: "سامانه مدیریت عملیات موسسه حقوقی ثبت کامیاب",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fa" dir="rtl" className={vazirmatn.variable}>
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
