import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { GlobalLoader } from '@/components/GlobalLoader'
import "./globals.css";
import { Toaster } from "sonner";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/react";
import { Providers } from "./providers";

// ใช้ next/font แทน Google Fonts inline → ไม่ blocking render, auto-optimize
const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
  preload: true,
});

export const metadata: Metadata = {
  title: "Task & Project Tracker",
  description: "Department Task and Project Management System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.className}>
      <body className="font-sans antialiased">
        <Providers>
          {children}
          <GlobalLoader />
        </Providers>
        <Toaster position="bottom-right" richColors />
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
