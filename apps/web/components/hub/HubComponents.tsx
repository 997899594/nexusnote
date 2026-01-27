'use client'

import { motion } from 'framer-motion'
import { BookOpen, Clock, ChevronRight, Search, Sparkles, ArrowRight, StickyNote, Command } from 'lucide-react'
import { useState } from 'react'

export function ProCourseCard({ title, progress, color = 'violet', lastActive = 'Just now', onClick }: CourseCardProps) {
    const colors: Record<string, string> = {
        violet: 'bg-violet-600',
        indigo: 'bg-indigo-600',
        emerald: 'bg-emerald-600',
        rose: 'bg-rose-600',
    }

    return (
        <div
            onClick={onClick}
            className="group relative bg-white border border-black/[0.08] hover:border-black/20 rounded-lg p-4 transition-all cursor-pointer h-full flex flex-col"
        >
            <div className="flex items-center justify-between mb-3">
                <div className={`w-8 h-8 ${colors[color]} rounded-md flex items-center justify-center shrink-0`}>
                    <span className="text-xs font-bold text-white">{title.substring(0, 2).toUpperCase()}</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${progress === 100 ? 'bg-emerald-500' : 'bg-black/20'}`} />
                    <span className="text-[10px] font-medium text-black/40 uppercase tracking-wide">{lastActive}</span>
                </div>
            </div>

            <h3 className="text-sm font-bold text-black mb-1 leading-snug line-clamp-2 transition-colors group-hover:text-violet-700">{title}</h3>

            <div className="mt-auto pt-4">
                <div className="flex items-center justify-between text-[10px] font-bold text-black/40 uppercase tracking-wider mb-1.5">
                    <span>Progress</span>
                    <span>{progress}%</span>
                </div>
                <div className="h-1 w-full bg-black/[0.04] rounded-full overflow-hidden">
                    <div
                        className={`h-full ${colors[color]} transition-all duration-500`}
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>
        </div>
    )
}

// ============================================
// Pro Note Row (Dense List View)
// ============================================

interface NoteRowProps {
    title: string
    preview: string
    date: string
    tags?: string[]
    onClick: () => void
}

export function ProNoteRow({ title, preview, date, tags, onClick }: NoteRowProps) {
    return (
        <div
            onClick={onClick}
            className="group flex items-center gap-4 p-3 bg-white border border-black/[0.06] hover:border-black/15 rounded-lg transition-all cursor-pointer"
        >
            <div className="shrink-0 w-8 h-8 bg-black/5 rounded flex items-center justify-center text-black/40">
                <StickyNote className="w-4 h-4" />
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="text-xs font-bold text-black truncate">{title}</h3>
                    {tags && tags.length > 0 && (
                        <span className="px-1 py-0.5 rounded bg-black/[0.04] text-[9px] font-medium text-black/50">
                            #{tags[0]}
                        </span>
                    )}
                </div>
                <p className="text-[10px] text-black/40 truncate font-medium">{preview || "No preview"}</p>
            </div>

            <span className="text-[10px] font-bold text-black/20 shrink-0">{date}</span>
        </div>
    )
}

// ============================================
// Command Bar (Omnibar Style)
// ============================================

export function CommandBar() {
    const [isFocused, setIsFocused] = useState(false)
    const [input, setInput] = useState('')

    return (
        <div className={`
            relative w-full max-w-2xl flex items-center gap-3 bg-white border rounded-lg px-4 py-2.5 transition-all duration-200
            ${isFocused
                ? 'border-black/20 ring-4 ring-black/[0.02] shadow-sm'
                : 'border-black/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.02)]'
            }
        `}>
            <Search className={`w-4 h-4 transition-colors ${isFocused ? 'text-black' : 'text-black/30'}`} />
            <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Search courses, notes, or navigate..."
                className="flex-1 bg-transparent text-sm font-medium text-black placeholder:text-black/30 outline-none"
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
            />
            <div className="flex items-center gap-2">
                <span className="flex items-center gap-[1px] px-1.5 py-0.5 rounded border border-black/10 bg-black/[0.02] text-[10px] font-bold text-black/40">
                    <Command className="w-3 h-3" />K
                </span>
            </div>
        </div>
    )
}
interface CourseCardProps {
    title: string
    progress: number
    color?: string
    lastActive?: string
    onClick: () => void
}

export function ModernCourseCard({ title, progress, color = 'violet', lastActive = 'Just now', onClick }: CourseCardProps) {
    const colors: Record<string, string> = {
        violet: 'bg-violet-600',
        indigo: 'bg-indigo-600',
        emerald: 'bg-emerald-600',
        rose: 'bg-rose-600',
    }

    return (
        <motion.div
            onClick={onClick}
            whileHover={{ y: -1 }}
            className="group bg-white border border-black/[0.06] rounded-xl overflow-hidden hover:border-black/10 transition-all cursor-pointer relative"
        >
            <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                    <div className={`w-10 h-10 ${colors[color]} rounded-lg flex items-center justify-center shrink-0`}>
                        <BookOpen className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-black/[0.03] text-[10px] font-bold text-black/40 uppercase tracking-wider">
                        <Clock className="w-3 h-3" />
                        {lastActive}
                    </div>
                </div>

                <h3 className="text-lg font-bold tracking-tight text-black mb-1 leading-snug line-clamp-2">{title}</h3>
                <p className="text-xs font-medium text-black/40 mb-6">Course Material</p>

                <div className="flex items-end justify-between">
                    <div className="flex-1 mr-6">
                        <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider mb-2">
                            <span className="text-black/30">Progress</span>
                            <span className="text-black">{progress}%</span>
                        </div>
                        <div className="h-1 w-full bg-black/[0.04] rounded-full overflow-hidden">
                            <div
                                className={`h-full ${colors[color]}`}
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>

                    <div className="w-8 h-8 rounded-lg bg-black/[0.02] flex items-center justify-center group-hover:bg-black group-hover:text-white transition-all">
                        <ChevronRight className="w-4 h-4 opacity-30 group-hover:opacity-100 transition-all" />
                    </div>
                </div>
            </div>
        </motion.div>
    )
}

// ============================================
// Modern Note Card (Quick Access)
// ============================================

interface NoteCardProps {
    title: string
    preview: string
    date: string
    tags?: string[]
    onClick: () => void
}

export function ModernNoteCard({ title, preview, date, tags, onClick }: NoteCardProps) {
    return (
        <motion.div
            onClick={onClick}
            whileHover={{ y: -1 }}
            className="group bg-white border border-black/[0.06] rounded-xl p-5 hover:border-black/10 transition-all cursor-pointer flex flex-col h-full"
        >
            <div className="flex items-start justify-between mb-3">
                <div className="px-2 py-1 rounded-md bg-black/[0.03] text-[10px] font-bold text-black/40 uppercase tracking-wider">
                    Note
                </div>
                <span className="text-[10px] font-medium text-black/30">{date}</span>
            </div>

            <h3 className="text-sm font-bold text-black mb-2 line-clamp-1">{title}</h3>
            <p className="text-xs text-black/50 line-clamp-3 mb-4 flex-1 leading-relaxed">
                {preview || "No content preview available."}
            </p>

            <div className="flex items-center gap-2 mt-auto">
                {tags?.slice(0, 2).map((tag) => (
                    <span key={tag} className="px-1.5 py-0.5 rounded-md border border-black/[0.05] text-[10px] font-medium text-black/40">
                        #{tag}
                    </span>
                ))}
            </div>
        </motion.div>
    )
}

// ============================================
// Modern Intent Input (Embedded & Direct)
// ============================================

export function ModernIntentInput() {
    const [isFocused, setIsFocused] = useState(false)

    return (
        <div
            className={`
                relative bg-white border rounded-xl overflow-hidden transition-all duration-200
                ${isFocused
                    ? 'border-violet-500/30 ring-4 ring-violet-500/5 shadow-sm'
                    : 'border-black/[0.06] shadow-sm hover:border-black/10'
                }
            `}
        >
            <div className="flex items-center px-4 py-3">
                <div className={`mr-4 transition-colors ${isFocused ? 'text-violet-500' : 'text-black/20'}`}>
                    <Sparkles className="w-5 h-5" />
                </div>
                <input
                    type="text"
                    placeholder="Ask anything or start a new course..."
                    className="flex-1 bg-transparent outline-none text-[15px] font-medium placeholder:text-black/20 text-black"
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                />
                <div className="flex items-center gap-2">
                    <div className="h-5 w-[1px] bg-black/[0.05]" />
                    <button className={`
                        p-1.5 rounded-lg transition-all
                        ${isFocused ? 'bg-violet-600 text-white' : 'bg-black/5 text-black/20 hover:text-black/50'}
                    `}>
                        <ArrowRight className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Context/Filter Bar (Appears on Focus) */}
            <motion.div
                initial={false}
                animate={{ height: isFocused ? 'auto' : 0, opacity: isFocused ? 1 : 0 }}
                className="overflow-hidden bg-[#fafafa] border-t border-black/[0.04]"
            >
                <div className="px-4 py-2 flex items-center gap-2">
                    {['Physics', 'Programming', 'History', 'Math'].map(tag => (
                        <button key={tag} className="px-2 py-1 bg-white border border-black/[0.06] rounded-md text-[10px] font-bold text-black/50 uppercase tracking-wider hover:border-black/20 transition-all">
                            {tag}
                        </button>
                    ))}
                </div>
            </motion.div>
        </div>
    )
}
