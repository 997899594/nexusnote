import type { Metadata } from "next";
import "./globals.css";
import { AuthSync, SessionProvider } from "@/ui/auth";
import { TransitionOverlay } from "@/ui/chat/components/TransitionOverlay";
import { MobileNav } from "@/ui/layout/components/MobileNav";

export const metadata: Metadata = {
  title: "NexusNote - 私人学习助理",
  description: "AI 驱动的个性化学习平台",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
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
  );
}
