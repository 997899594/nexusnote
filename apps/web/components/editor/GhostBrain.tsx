'use client'

import { useEffect, useState, useRef } from 'react'
import { Editor } from '@tiptap/react'
import { motion, AnimatePresence } from 'framer-motion'
import { Ghost, Sparkles, X } from 'lucide-react'

interface GhostBrainProps {
    editor: Editor | null
    documentId: string
    title?: string
}

const INACTIVITY_THRESHOLD = 20000 // 20 seconds
const ANALYSIS_COOLDOWN = 120000 // 2 minutes

export function GhostBrain({ editor, documentId, title }: GhostBrainProps) {
    const [comment, setComment] = useState<string | null>(null)
    const [isThinking, setIsThinking] = useState(false)
    const lastChangeTime = useRef<number>(Date.now())
    const lastAnalysisTime = useRef<number>(0)
    const isActive = useRef<boolean>(true)

    useEffect(() => {
        if (!editor) return

        const handleUpdate = () => {
            lastChangeTime.current = Date.now()
            if (comment) setComment(null)
        }

        const handleFocus = () => { isActive.current = true }
        const handleBlur = () => { isActive.current = false }

        editor.on('update', handleUpdate)
        editor.on('focus', handleFocus)
        editor.on('blur', handleBlur)

        const timer = setInterval(async () => {
            const now = Date.now()

            // Conditions for Ghost Intervention:
            // 1. Inactive for threshold
            // 2. Editor is focused
            // 3. Not recently analyzed (cooldown)
            // 4. Not currently thinking or showing a comment
            if (
                now - lastChangeTime.current > INACTIVITY_THRESHOLD &&
                isActive.current &&
                now - lastAnalysisTime.current > ANALYSIS_COOLDOWN &&
                !isThinking &&
                !comment
            ) {
                // Get surrounding context from current selection
                const { from } = editor.state.selection
                const context = editor.getText().slice(Math.max(0, from - 500), from + 500)

                if (context.trim().length < 50) return // Don't bother with empty docs

                console.log('[GhostBrain] Detecting inactivity, analyzing context...')
                setIsThinking(true)
                lastAnalysisTime.current = now

                try {
                    const res = await fetch('/api/ghost/analyze', {
                        method: 'POST',
                        body: JSON.stringify({ context, documentTitle: title }),
                    })

                    if (res.ok) {
                        const text = await res.text()
                        if (text && text.trim().length > 0) {
                            setComment(text.trim())
                        }
                    }
                } catch (err) {
                    console.error('[GhostBrain] Analysis failed:', err)
                } finally {
                    setIsThinking(false)
                }
            }
        }, 5000)

        return () => {
            editor.off('update', handleUpdate)
            editor.off('focus', handleFocus)
            editor.off('blur', handleBlur)
            clearInterval(timer)
        }
    }, [editor, comment, isThinking, title])

    return (
        <AnimatePresence>
            {comment && (
                <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                    className="fixed bottom-20 right-10 z-[100] max-w-sm"
                >
                    <div className="bg-violet-600 dark:bg-violet-700 text-white p-4 rounded-2xl shadow-2xl border border-violet-400/30 relative">
                        <div className="absolute -top-3 -left-3 bg-violet-500 rounded-full p-1.5 shadow-lg">
                            <Ghost className="w-4 h-4 text-white animate-pulse" />
                        </div>

                        <button
                            onClick={() => setComment(null)}
                            className="absolute top-2 right-2 text-violet-200 hover:text-white transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>

                        <div className="flex gap-3">
                            <div className="flex-1">
                                <p className="text-sm leading-relaxed italic">
                                    "{comment}"
                                </p>
                                <div className="flex items-center gap-1 mt-2 text-[10px] text-violet-200 uppercase tracking-widest font-bold">
                                    <Sparkles className="w-3 h-3" />
                                    Ghost Thought
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Ghost Tail / Bubble Tip */}
                    <div className="absolute bottom-0 right-10 translate-y-2 w-4 h-4 bg-violet-600 transform rotate-45" />
                </motion.div>
            )}
        </AnimatePresence>
    )
}
