import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Balanced - Work/Life Planner",
  description: "Plan tasks, track balance between work and life.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Balanced",
  },
};

export const viewport: Viewport = {
  themeColor: "#6366f1",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${plusJakartaSans.variable} h-full antialiased`}>
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <style>{`
          :root {
            --ring-bg: rgba(0, 0, 0, 0.06);
            --text-primary: #1f2937;
            --text-subtle: #d1d5db;
            --badge-bg: rgba(0, 0, 0, 0.04);
            --btn-default-text: #9ca3af;

            --area-life-bg: rgba(139, 92, 246, 0.12);
            --area-life-text: #7c3aed;
            --area-work-bg: rgba(59, 130, 246, 0.12);
            --area-work-text: #2563eb;
            --area-finances-bg: rgba(16, 185, 129, 0.12);
            --area-finances-text: #059669;
            --area-relationships-bg: rgba(244, 63, 94, 0.12);
            --area-relationships-text: #e11d48;
            --area-health-bg: rgba(239, 68, 68, 0.12);
            --area-health-text: #dc2626;
            --area-growth-bg: rgba(245, 158, 11, 0.12);
            --area-growth-text: #d97706;
          }

          @media (prefers-color-scheme: dark) {
            :root {
              --ring-bg: rgba(255, 255, 255, 0.08);
              --text-primary: #e5e7eb;
              --text-subtle: #4b5563;
              --badge-bg: rgba(255, 255, 255, 0.06);
              --btn-default-text: #6b7280;

              --area-life-bg: rgba(139, 92, 246, 0.2);
              --area-life-text: #a78bfa;
              --area-work-bg: rgba(59, 130, 246, 0.2);
              --area-work-text: #93c5fd;
              --area-finances-bg: rgba(16, 185, 129, 0.2);
              --area-finances-text: #6ee7b7;
              --area-relationships-bg: rgba(244, 63, 94, 0.2);
              --area-relationships-text: #fda4af;
              --area-health-bg: rgba(239, 68, 68, 0.2);
              --area-health-text: #fca5a5;
              --area-growth-bg: rgba(245, 158, 11, 0.2);
              --area-growth-text: #fde68a;
            }
          }
        `}</style>
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <div className="background-mesh">
          <div className="blob-3" />
        </div>
        <div className="relative z-10 flex-1 flex flex-col">
          <Providers>{children}</Providers>
        </div>
      </body>
    </html>
  );
}
