'use client'

import { Home, BookOpen, Layers, Settings, LogOut, FileText, Search, Zap, Plus } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'

export function AppSidebar() {
    const pathname = usePathname()
    const router = useRouter()

    const navItems = [
        { icon: Plus, label: 'Create Course', href: '/create', highlight: true },
        { icon: Home, label: 'Dashboard', href: '/' },
        { icon: BookOpen, label: 'Courses', href: '/courses' }, // Placeholder route
        { icon: FileText, label: 'Notes', href: '/notes' },     // Placeholder route
        { icon: Layers, label: 'Resources', href: '/resources' }, // Placeholder route
    ] as const;

    return (
        <aside className="hidden md:flex fixed left-0 top-0 h-full w-[240px] bg-zinc-50 border-r border-black/[0.06] flex-col z-50">
            {/* 1. Brand Header */}
            <div className="h-16 flex items-center px-6 border-b border-black/[0.04]">
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-black rounded-md flex items-center justify-center">
                        <Zap className="w-3.5 h-3.5 text-white fill-white" />
                    </div>
                    <span className="text-sm font-bold tracking-tight text-black">NexusNote</span>
                </div>
            </div>

            {/* 2. Main Navigation */}
            <nav className="flex-1 px-3 py-6 space-y-1">
                <div className="px-3 mb-2 text-[10px] font-bold text-black/30 uppercase tracking-widest">Platform</div>
                {navItems.map((item) => {
                    const isActive = pathname === item.href
                    const isHighlight = 'highlight' in item && item.highlight
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`
                flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all
                ${isHighlight && !isActive
                                    ? 'bg-violet-600 text-white hover:bg-violet-700'
                                    : isActive
                                        ? 'bg-black/5 text-black'
                                        : 'text-black/50 hover:bg-black/[0.02] hover:text-black/80'
                                }
              `}
                        >
                            <item.icon className="w-4 h-4" />
                            {item.label}
                        </Link>
                    )
                })}

                <div className="px-3 mt-8 mb-2 text-[10px] font-bold text-black/30 uppercase tracking-widest">Library</div>
                <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-black/50 hover:bg-black/[0.02] hover:text-black/80 transition-all text-left">
                    <div className="w-4 h-4 rounded bg-orange-500/20 flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                    </div>
                    Favorites
                </button>
                <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-black/50 hover:bg-black/[0.02] hover:text-black/80 transition-all text-left">
                    <div className="w-4 h-4 rounded bg-blue-500/20 flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    </div>
                    Archive
                </button>
            </nav>

            {/* 3. User Profile / Settings */}
            <div className="p-4 border-t border-black/[0.04]">
                <button className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-black/[0.02] transition-colors">
                    <div className="w-8 h-8 rounded-full bg-black/10 flex items-center justify-center text-xs font-bold text-black/50">
                        USR
                    </div>
                    <div className="text-left flex-1">
                        <div className="text-xs font-semibold text-black">User Account</div>
                        <div className="text-[10px] text-black/40">Pro Plan</div>
                    </div>
                    <Settings className="w-4 h-4 text-black/30" />
                </button>
            </div>
        </aside>
    )
}
