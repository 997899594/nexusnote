import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthSync, SessionProvider } from "@/components/auth";
import { ToastProvider } from "@/components/ui/Toast";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1a1a" },
  ],
};

export const metadata: Metadata = {
  title: "NexusNote - 私人学习助理",
  description: "AI 驱动的个性化学习平台",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "NexusNote",
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-icon.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" data-theme="default">
      <body suppressHydrationWarning>
        <SessionProvider>
          <ToastProvider>
            <AuthSync />
            <div className="min-h-dvh">{children}</div>
          </ToastProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
