'use client'

import { motion } from 'framer-motion'
import {
    Search,
    Layout,
    Settings,
    Edit3,
    Sun,
    Moon,
    Shield,
    ShieldOff
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

interface AdaptiveDockProps {
    isVault?: boolean
    onToggleVault?: () => void
}

export function AdaptiveDock({ isVault, onToggleVault }: AdaptiveDockProps) {
    const { theme, setTheme } = useTheme()
    const [mounted, setMounted] = useState(false)

    // Avoid hydration mismatch
    useEffect(() => setMounted(true), [])

    if (!mounted) return null

    const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark')

    return (
        <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="fixed z-[100] transition-all duration-500
                 bottom-6 left-1/2 -translate-x-1/2 md:top-8 md:bottom-auto w-[92%] md:w-auto"
        >
            <div className="glass-panel flex items-center justify-between md:justify-start gap-2 p-2 px-4 rounded-full shadow-2xl overflow-visible">
                {/* Core Branding/Action */}
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20 active:scale-95 transition-transform cursor-pointer">
                    <Edit3 className="w-5 h-5 text-white" />
                </div>

                <div className="h-4 w-px bg-border mx-1 hidden md:block" />

                {/* Global Tools */}
                <div className="flex items-center gap-1 md:gap-2">
                    <button className="p-2.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-all active:scale-90" title="搜索 (Cmd+K)">
                        <Search className="w-5 h-5" />
                    </button>
                    <button className="p-2.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-all active:scale-90" title="知识图谱">
                        <Layout className="w-5 h-5" />
                    </button>

                    <button
                        onClick={toggleTheme}
                        className="p-2.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-all active:scale-90"
                        title={theme === 'dark' ? '切换浅色模式' : '切换深色模式'}
                    >
                        {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                    </button>

                    <button className="p-2.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-all active:scale-90 hidden md:flex" title="设置">
                        <Settings className="w-5 h-5" />
                    </button>
                </div>

                <div className="h-4 w-px bg-border mx-1" />

                {/* Status Actions (Vault Mode) */}
                <div className="flex items-center gap-3 pl-2 pr-1 h-full cursor-pointer group" onClick={onToggleVault}>
                    <span className="text-[10px] font-bold tracking-[0.1em] text-muted-foreground uppercase hidden md:inline-block select-none">
                        隐私保险箱
                    </span>
                    <div className={`w-10 h-5 rounded-full border transition-all duration-500 p-0.5 relative flex items-center ${isVault
                            ? 'bg-violet-600/20 border-violet-500/30'
                            : 'bg-muted border-border'
                        }`}>
                        <motion.div
                            animate={{ x: isVault ? 20 : 0 }}
                            transition={{ type: "spring", stiffness: 400, damping: 30 }}
                            className={`w-4 h-4 rounded-full flex items-center justify-center shadow-sm ${isVault ? 'bg-violet-500 shadow-violet-500/50' : 'bg-muted-foreground/30'
                                }`}
                        >
                            {isVault ? <Shield className="w-2.5 h-2.5 text-white" /> : <ShieldOff className="w-2.5 h-2.5 text-white/50" />}
                        </motion.div>
                    </div>
                </div>
            </div>
        </motion.div>
    )
}
