import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { SessionProvider } from 'next-auth/react'
import { SessionWatcher } from '@/components/auth/SessionWatcher'
import { ThemeProvider } from '@/components/layout/ThemeProvider'
import { Aura } from '@/components/layout/Aura'
import { AdaptiveDock } from '@/components/layout/AdaptiveDock'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'NexusNote - AI 驱动的智慧知识库',
  description: '本地优先、AI 驱动的次世代智慧知识库',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className={`${inter.className} antialiased selection:bg-violet-500/10`}>
        <SessionProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem
            disableTransitionOnChange
          >
            <SessionWatcher />
            <main className="relative min-h-screen bg-white">
              {children}
            </main>
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  )
}
