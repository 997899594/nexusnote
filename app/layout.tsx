import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthSync, SessionProvider } from "@/components/auth";
import { TransitionOverlay } from "@/components/chat/TransitionOverlay";
import { MobileNav } from "@/components/shared/layout";
import { AI } from "./ai-ui/AIProvider";

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
    <AI>
      <html lang="zh-CN" data-theme="default">
        <body>
          <SessionProvider>
            <AuthSync />
            <div className="min-h-screen">{children}</div>
            <MobileNav />
            <TransitionOverlay />
          </SessionProvider>
        </body>
      </html>
    </AI>
  );
}
