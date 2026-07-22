import type { Metadata } from "next";
import { GlobalLoader } from '@/components/GlobalLoader'
import "./globals.css";
import { Toaster } from "sonner";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/react";
import { Providers } from "./providers";

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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </head>
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
