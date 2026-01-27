'use client'

import { Home, Plus, FileText, BookOpen } from 'lucide-react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

export function MobileNav() {
    const pathname = usePathname()

    const navItems = [
        { icon: Home, label: 'Home', href: '/' },
        { icon: BookOpen, label: 'Courses', href: '/courses' },
        { icon: Plus, label: 'Create', href: '/create', isCreate: true },
        { icon: FileText, label: 'Notes', href: '/notes' },
    ]

    return (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-black/10 z-50 safe-area-inset-bottom">
            <div className="flex items-center justify-around px-2 py-2">
                {navItems.map((item) => {
                    const isActive = pathname === item.href
                    const isCreate = (item as any).isCreate

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`
                                flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-xl transition-all min-w-[64px]
                                ${isCreate
                                    ? 'bg-violet-600 text-white scale-110 shadow-lg'
                                    : isActive
                                        ? 'text-black'
                                        : 'text-black/40'
                                }
                            `}
                        >
                            <item.icon className={`w-5 h-5 ${isCreate ? 'stroke-[2.5]' : ''}`} />
                            <span className={`text-[10px] font-bold ${isCreate ? 'hidden' : ''}`}>
                                {item.label}
                            </span>
                        </Link>
                    )
                })}
            </div>
        </nav>
    )
}
