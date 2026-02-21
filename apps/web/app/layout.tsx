import type { Metadata } from "next";
import "./globals.css";
import { AuthSync, SessionProvider } from "@/features/auth";
import { MobileNav } from "@/features/layout/components/MobileNav";

export const metadata: Metadata = {
  title: "NexusNote - AI Learning Platform",
  description: "AI-powered learning platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <SessionProvider>
          <AuthSync />
          <div className="min-h-screen">{children}</div>
          <MobileNav />
        </SessionProvider>
      </body>
    </html>
  );
}
