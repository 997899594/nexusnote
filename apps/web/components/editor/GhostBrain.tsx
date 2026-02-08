'use client'

import { useEffect, useState, useRef } from 'react'
import { Editor } from '@tiptap/react'
import { motion, AnimatePresence } from 'framer-motion'
import { Ghost, Sparkles, X, Zap } from 'lucide-react'
import { ghostAnalyzeAction } from '@/app/actions/ai'

interface GhostBrainProps {
    editor: Editor | null
    documentId: string
    title?: string
}

const INACTIVITY_THRESHOLD = 20000
const ANALYSIS_COOLDOWN = 120000

export function GhostBrain({ editor, documentId, title }: GhostBrainProps) {
    const [comment, setComment] = useState<string | null>(null)
    const [isThinking, setIsThinking] = useState(false)
    const lastChangeTime = useRef<number>(Date.now())
    const lastAnalysisTime = useRef<number>(0)
    const isActive = useRef<boolean>(true)

    useEffect(() => {
        if (!editor) return
        const handleUpdate = () => { lastChangeTime.current = Date.now(); if (comment) setComment(null) }
        const handleFocus = () => { isActive.current = true }
        const handleBlur = () => { isActive.current = false }
        editor.on('update', handleUpdate)
        editor.on('focus', handleFocus)
        editor.on('blur', handleBlur)

        const timer = setInterval(async () => {
            const now = Date.now()
            if (now - lastChangeTime.current > INACTIVITY_THRESHOLD && isActive.current && now - lastAnalysisTime.current > ANALYSIS_COOLDOWN && !isThinking && !comment) {
                if (!editor.state) return
                const { from } = editor.state.selection
                const context = editor.getText().slice(Math.max(0, from - 500), from + 500)
                if (context.trim().length < 50) return
                setIsThinking(true)
                lastAnalysisTime.current = now
                try {
                    // 架构师重构：将 fetch 替换为 Server Action
                    const response = await ghostAnalyzeAction({ 
                        context, 
                        documentTitle: title 
                    })
                    
                    if (response.ok) {
                        const text = await response.text()
                        if (text?.trim()) setComment(text.trim())
                    }
                } catch (err) { } finally { setIsThinking(false) }
            }
        }, 5000)

        return () => {
            editor.off('update', handleUpdate)
            editor.off('focus', handleFocus)
            editor.off('blur', handleBlur)
            clearInterval(timer)
        }
    }, [editor, comment, isThinking, title])

    const handleApply = () => {
        if (!editor || !comment) return
        editor.chain().focus().insertContent(`\n\n> AI 建议: ${comment}\n\n`).run()
        setComment(null)
    }

    return (
        <AnimatePresence>
            {comment && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.8, x: 20, y: 20 }}
                    animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
                    exit={{ opacity: 0, scale: 0.8, x: 20, transition: { duration: 0.2 } }}
                    className="fixed bottom-28 right-8 z-[110] max-w-[320px] md:max-w-sm"
                >
                    <div className="glass-panel p-5 rounded-[2.5rem] relative overflow-visible shadow-2xl border-violet-500/20">
                        {/* Status Icon */}
                        <div className="absolute -top-4 -left-4 w-12 h-12 bg-violet-600 rounded-2xl flex items-center justify-center shadow-lg shadow-violet-950/40 ring-4 ring-background">
                            <Ghost className="w-6 h-6 text-white animate-pulse" />
                        </div>

                        {/* Top Controls */}
                        <div className="flex justify-end mb-2">
                            <button
                                onClick={() => setComment(null)}
                                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-muted-foreground/60 hover:text-foreground"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="px-1">
                            <p className="text-sm md:text-md leading-relaxed italic text-foreground/80 pr-2">
                                “{comment}”
                            </p>

                            <div className="mt-5 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-violet-500 animate-ping" />
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-500/60">Ghost Pilot</span>
                                </div>
                                <button
                                    onClick={handleApply}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white rounded-xl text-[10px] font-bold shadow-lg shadow-violet-900/10 hover:scale-[1.05] active:scale-95 transition-all"
                                >
                                    <Zap className="w-3 h-3 fill-current" />
                                    立即采纳
                                </button>
                            </div>
                        </div>

                        {/* Spatial Glow */}
                        <div className="absolute inset-0 -z-10 bg-violet-500/5 blur-3xl rounded-[2.5rem]" />
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
