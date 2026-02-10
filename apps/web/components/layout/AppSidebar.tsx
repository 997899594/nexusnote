'use client'

import { Home, BookOpen, Layers, Settings, FileText, Zap } from 'lucide-react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export function AppSidebar() {
  const pathname = usePathname()

  const navItems = [
    { icon: Home, label: '首页', href: '/' },
    { icon: BookOpen, label: '学习', href: '/learn' },
    { icon: FileText, label: '笔记', href: '/editor' },
    { icon: Layers, label: '资源', href: '/resources' },
  ]

  return (
    <aside className="hidden md:flex flex-col w-64 h-screen sticky top-0 bg-surface-50/50 border-r border-border/5">
      <div className="h-16 flex items-center px-6 border-b border-border/5">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-primary rounded-md flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-primary-foreground fill-primary-foreground" />
          </div>
          <span className="font-bold text-xl tracking-tight text-foreground">NexusNote</span>
        </div>
      </div>

      <nav className="flex-1 px-3 py-6 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl',
                'transition-all duration-200',
                isActive
                  ? 'bg-primary text-primary-foreground font-medium'
                  : 'text-foreground/70 hover:bg-foreground/5 hover:text-foreground'
              )}
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="p-3 border-t border-border/5">
        <Link
          href="/settings"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-foreground/70 hover:bg-foreground/5 transition-all duration-200"
        >
          <Settings className="w-5 h-5" />
          <span>设置</span>
        </Link>
      </div>
    </aside>
  )
}
