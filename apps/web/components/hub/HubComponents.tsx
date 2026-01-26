'use client'

import { motion } from 'framer-motion'
import { BookOpen, Clock, MoreVertical, Sparkles, Zap, ChevronRight } from 'lucide-react'

// ============================================
// Course Card (Performance Optimized Minimalism)
// ============================================

export function CourseCard({ title, progress, lastActive, type = 'course' }: any) {
    return (
        <motion.div
            whileHover={{ scale: 1.01, backgroundColor: 'rgba(255, 255, 255, 0.03)' }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="glass-panel group relative flex flex-col p-6 rounded-3xl h-full cursor-pointer border-white/10 dark:border-white/5 active:scale-[0.98] shadow-md"
        >
            <div className="flex items-start justify-between mb-4 z-10">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${type === 'course' ? 'bg-violet-500/10 text-violet-500' : 'bg-indigo-500/10 text-indigo-500'}`}>
                    <BookOpen className="w-5 h-5" />
                </div>
                <button className="p-1.5 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition-colors">
                    <MoreVertical className="w-4 h-4 text-muted-foreground/30" />
                </button>
            </div>

            <div className="flex-1 z-10">
                <h3 className="text-base font-bold tracking-tight mb-2 leading-snug text-foreground/90">{title}</h3>
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60 font-medium">
                    <Clock className="w-3.5 h-3.5" />
                    {lastActive}
                </div>
            </div>

            <div className="mt-6 flex items-center justify-between gap-4 z-10">
                <div className="flex-1">
                    <div className="flex items-center justify-between mb-1.5 px-0.5">
                        <span className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-wider">掌握进度</span>
                        <span className="text-[10px] font-black text-violet-500">{progress}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 1, ease: "easeOut" }}
                            className="h-full bg-violet-500"
                        />
                    </div>
                </div>
            </div>
        </motion.div>
    )
}

// ============================================
// Stats Card (Performance Optimized Minimalism)
// ============================================

export function HubStatsCard({ icon: Icon, title, value, label, trend, color = 'violet' }: any) {
    const colorMap: any = {
        violet: 'text-violet-600 dark:text-violet-400',
        indigo: 'text-indigo-600 dark:text-indigo-400',
        rose: 'text-rose-600 dark:text-rose-400',
        emerald: 'text-emerald-600 dark:text-emerald-400',
    }

    return (
        <motion.div
            whileHover={{ scale: 1.02 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="glass-panel p-6 rounded-3xl flex flex-col justify-between h-full border-white/5 shadow-sm group"
        >
            <div className="flex items-center justify-between mb-4">
                <div className={`w-10 h-10 rounded-xl bg-black/5 dark:bg-white/5 flex items-center justify-center ${colorMap[color]}`}>
                    <Icon className="w-5 h-5" />
                </div>
                {trend && (
                    <div className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold ${trend > 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                        {trend > 0 ? '+' : '-'}{Math.abs(trend)}%
                    </div>
                )}
            </div>

            <div>
                <h4 className="text-[11px] font-bold text-muted-foreground/40 mb-1 truncate uppercase tracking-wider">{title}</h4>
                <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl font-bold tracking-tight text-foreground">{value}</span>
                    <span className="text-[10px] font-medium text-muted-foreground/40">{label}</span>
                </div>
            </div>
        </motion.div>
    )
}

// ============================================
// AI Recommendation (Performance Optimized Minimalism)
// ============================================

export function HubAIRecommendation({ text }: { text: string }) {
    return (
        <motion.div
            whileHover={{ backgroundColor: 'rgba(139, 92, 246, 0.08)' }}
            className="p-6 rounded-3xl bg-violet-500/5 border border-violet-500/10 relative overflow-hidden group transition-colors duration-200"
        >
            <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-violet-500" />
                <span className="text-[11px] font-bold text-violet-500/80 uppercase tracking-wider">学习建议</span>
            </div>

            <p className="text-sm font-medium leading-relaxed text-foreground/80 mb-5">{text}</p>

            <button className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-xl text-[11px] font-bold hover:bg-violet-700 transition-colors">
                立即处理
                <ChevronRight className="w-3.5 h-3.5" />
            </button>
        </motion.div>
    )
}
