import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { SessionProvider } from 'next-auth/react'
import { ThemeProvider } from '@/components/layout/ThemeProvider'
import { MobileNav } from '@/components/layout/MobileNav'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
    title: 'NexusNote - AI Course Engine',
    description: 'Pure focus learning driven by AI.',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="zh-CN" suppressHydrationWarning>
            <body className={inter.className}>
                <SessionProvider>
                    <ThemeProvider attribute="class" defaultTheme="light">
                        <main className="min-h-screen bg-white pb-16 md:pb-0">
                            {children}
                        </main>
                        <MobileNav />
                    </ThemeProvider>
                </SessionProvider>
            </body>
        </html>
    )
}
