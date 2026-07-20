import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { GlobalLoader } from '@/components/GlobalLoader'
import "./globals.css";
import { Toaster } from "sonner";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/react";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"] });

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
    <html lang="en">
      <body className={`${inter.className} antialiased`}>
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
