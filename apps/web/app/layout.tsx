import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { SessionProvider } from "next-auth/react";
import { MobileNav } from "@/components/layout/MobileNav";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { PWAProvider } from "@/components/pwa/PWAProvider";
import { Toaster } from "@/components/ui/Toast";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "NexusNote - AI Course Engine",
  description: "Pure focus learning driven by AI.",
  manifest: "/manifest.json",
  themeColor: "#000000",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "NexusNote",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className={inter.className}>
        <PWAProvider>
          <SessionProvider>
            <ThemeProvider attribute="class" defaultTheme="light">
              <main className="min-h-screen bg-white pb-16 md:pb-0">{children}</main>
              <MobileNav />
              <Toaster />
            </ThemeProvider>
          </SessionProvider>
        </PWAProvider>
      </body>
    </html>
  );
}
