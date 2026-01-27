'use client'

import { motion } from 'framer-motion'
import { BookOpen, Clock, ChevronRight } from 'lucide-react'

export function CourseCard({ title, progress, color = 'violet', onClick }: any) {
    const colorMap: any = {
        violet: 'bg-violet-600',
        indigo: 'bg-indigo-600',
        emerald: 'bg-emerald-600',
    }

    return (
        <motion.div
            whileHover={{ y: -4 }}
            onClick={onClick}
            className="group p-10 bg-white border border-black/[0.05] rounded-[2.5rem] shadow-sm hover:shadow-xl transition-all cursor-pointer relative overflow-hidden flex items-center justify-between gap-12"
        >
            <div className="flex items-center gap-8 min-w-0">
                <div className={`w-12 h-12 ${colorMap[color] || 'bg-violet-600'} rounded-2xl shadow-lg flex items-center justify-center shrink-0`}>
                    <BookOpen className="w-6 h-6 text-white" />
                </div>
                <div className="min-w-0">
                    <h3 className="text-xl font-bold italic uppercase leading-tight truncate">{title}</h3>
                    <div className="flex items-center gap-2 mt-1 opacity-20">
                        <Clock className="w-3 h-3" />
                        <span className="text-[10px] font-black uppercase tracking-widest">学习中</span>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-8 shrink-0">
                <div className="text-right">
                    <div className="text-[10px] font-black uppercase tracking-widest opacity-20 mb-1">完成度</div>
                    <div className="text-2xl font-black italic tracking-tighter text-violet-600">{progress}%</div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-black/[0.02] flex items-center justify-center group-hover:bg-violet-600 transition-colors">
                    <ChevronRight className="w-5 h-5 opacity-20 group-hover:opacity-100 group-hover:text-white transition-all" />
                </div>
            </div>

            {/* Subtle Progress Underline */}
            <div className="absolute bottom-0 left-0 h-1 bg-violet-600/10 w-full overflow-hidden">
                <div
                    className={`h-full ${colorMap[color] || 'bg-violet-600'} opacity-30`}
                    style={{ width: `${progress}%` }}
                />
            </div>
        </motion.div>
    )
}

// Minimal Stats and AI Recommendation are now integrated or removed as per "Flow-Centric" direction.
