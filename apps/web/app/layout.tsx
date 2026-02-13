import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { SessionProvider } from 'next-auth/react'
import { ThemeProvider } from '@/features/shared/components/layout/ThemeProvider'
import { MobileNav } from '@/features/shared/components/layout/MobileNav'
import { AppSidebar } from '@/features/shared/components/layout/AppSidebar'
import { PWAProvider } from '@/features/shared/components/pwa/PWAProvider'
import { Toaster } from '@/features/shared/components/ui/Toast'
import './globals.css'

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: 'NexusNote - AI Course Engine',
    description: 'Pure focus learning driven by AI.',
    manifest: '/manifest.json',
    themeColor: '#000000',
    appleWebApp: {
        capable: true,
        statusBarStyle: 'default',
        title: 'NexusNote',
    },
    icons: {
        icon: '/icon.svg',
        apple: '/icon.svg',
    },
    viewport: {
        width: 'device-width',
        initialScale: 1,
        maximumScale: 5,
        userScalable: true,
    },
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="zh-CN" suppressHydrationWarning>
            <body className={inter.className}>
                <PWAProvider>
                    <SessionProvider>
                        <ThemeProvider attribute="class" defaultTheme="light">
                            <div className="flex h-screen bg-background">
                                <AppSidebar />
                                <main className="flex-1 min-h-screen pb-safe-bottom md:pb-0">
                                    {children}
                                </main>
                                <MobileNav />
                            </div>
                            <Toaster />
                        </ThemeProvider>
                    </SessionProvider>
                </PWAProvider>
            </body>
        </html>
    )
}
