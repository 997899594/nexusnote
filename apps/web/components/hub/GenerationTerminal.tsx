'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Terminal, Check, Loader2, Sparkles, X, ChevronRight } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { learningStore } from '@/lib/storage'

interface GenerationTerminalProps {
    isOpen: boolean
    onClose: () => void
    intent: string
}

type LogStep = {
    id: string
    text: string
    status: 'pending' | 'processing' | 'completed' | 'error'
    timestamp: number
}

export function GenerationTerminal({ isOpen, onClose, intent }: GenerationTerminalProps) {
    const router = useRouter()
    const [steps, setSteps] = useState<LogStep[]>([])
    const [isGenerating, setIsGenerating] = useState(false)
    const logsEndRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (isOpen && intent) {
            startGeneration(intent)
        } else {
            setSteps([])
            setIsGenerating(false)
        }
    }, [isOpen, intent])

    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [steps])

    const addLog = (text: string, status: LogStep['status'] = 'pending') => {
        const id = Math.random().toString(36).substring(7)
        setSteps(prev => [...prev, { id, text, status, timestamp: Date.now() }])
        return id
    }

    const updateLog = (id: string, updates: Partial<LogStep>) => {
        setSteps(prev => prev.map(step => step.id === id ? { ...step, ...updates } : step))
    }

    const startGeneration = async (goal: string) => {
        setIsGenerating(true)
        setSteps([])

        // 1. Analysis Phase
        const analysisId = addLog('Initializing neuro-symbolic analysis...', 'processing')
        await new Promise(r => setTimeout(r, 800))
        updateLog(analysisId, { status: 'completed' })

        const intentId = addLog(`Deconstructing intent: "${goal}"`, 'processing')
        await new Promise(r => setTimeout(r, 600))
        updateLog(intentId, { status: 'completed' })

        // 2. Structuring Phase (API Call)
        const structId = addLog('Architecting knowledge graph...', 'processing')

        try {
            const response = await fetch('/api/learn/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ goal }),
            })

            if (!response.ok) throw new Error('Generation failed')

            const outline = await response.json()
            updateLog(structId, { status: 'completed' })

            addLog(`Identified ${outline.chapters.length} core knowledge nodes`, 'completed')

            // 3. Asset Compilation
            const compileId = addLog('Compiling learning assets...', 'processing')
            const content = await learningStore.createFromOutline(outline)
            await new Promise(r => setTimeout(r, 800)) // Artificial delay for effect
            updateLog(compileId, { status: 'completed' })

            // 4. Finalization
            addLog('Session ready. Redirecting to Editor...', 'completed')
            await new Promise(r => setTimeout(r, 600))

            router.push(`/editor/${content.id}`)
            onClose()

        } catch (error) {
            console.error(error)
            updateLog(structId, { status: 'error', text: 'Structure generation failed' })
            addLog('Aborting sequence.', 'error')
            setIsGenerating(false)
        }
    }

    if (!isOpen) return null

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            >
                <div
                    className="fixed inset-0"
                    onClick={!isGenerating ? onClose : undefined}
                />

                <motion.div
                    initial={{ scale: 0.95, opacity: 0, y: 10 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 10 }}
                    className="relative w-full max-w-2xl bg-[#09090b] text-zinc-100 rounded-xl overflow-hidden shadow-2xl border border-zinc-800 font-mono"
                >
                    {/* Terminal Header */}
                    <div className="flex items-center justify-between px-4 py-3 bg-zinc-900/50 border-b border-zinc-800">
                        <div className="flex items-center gap-2 text-zinc-400">
                            <Terminal className="w-4 h-4" />
                            <span className="text-xs font-bold uppercase tracking-wider">Nexus Core // Generator</span>
                        </div>
                        {!isGenerating && (
                            <button
                                onClick={onClose}
                                className="p-1 hover:bg-zinc-800 rounded transition-colors text-zinc-500 hover:text-zinc-300"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    {/* Terminal Window */}
                    <div className="p-6 h-[400px] overflow-y-auto bg-black/50 custom-scrollbar relative">
                        {/* Background Noise/Grid (Optional) */}
                        <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
                            style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '20px 20px' }}
                        />

                        <div className="space-y-3 relative z-10">
                            {steps.map((step) => (
                                <motion.div
                                    key={step.id}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="flex items-start gap-3 text-sm"
                                >
                                    <div className="mt-0.5 shrink-0">
                                        {step.status === 'processing' && (
                                            <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
                                        )}
                                        {step.status === 'completed' && (
                                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                                        )}
                                        {step.status === 'error' && (
                                            <X className="w-3.5 h-3.5 text-red-500" />
                                        )}
                                        {step.status === 'pending' && (
                                            <div className="w-3.5 h-3.5 rounded-full border border-zinc-700" />
                                        )}
                                    </div>
                                    <div className={
                                        step.status === 'completed' ? 'text-zinc-400' :
                                            step.status === 'error' ? 'text-red-400' :
                                                step.status === 'processing' ? 'text-blue-400' :
                                                    'text-zinc-500'
                                    }>
                                        <span className="mr-3 opacity-30 select-none">
                                            {new Date(step.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                        </span>
                                        {step.text}
                                    </div>
                                </motion.div>
                            ))}
                            {isGenerating && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: [0, 1, 0] }}
                                    transition={{ repeat: Infinity, duration: 0.8 }}
                                    className="w-2 h-4 bg-blue-500/50 mt-1"
                                />
                            )}
                            <div ref={logsEndRef} />
                        </div>
                    </div>

                    {/* Footer Status */}
                    <div className="px-4 py-2 border-t border-zinc-800 bg-zinc-900/30 flex justify-between items-center text-[10px] uppercase tracking-wider text-zinc-600">
                        <span>CPU: 12%</span>
                        <span>MEM: 256MB</span>
                        <span className={isGenerating ? "text-blue-500 animate-pulse" : "text-zinc-600"}>
                            {isGenerating ? "Processing" : "Idle"}
                        </span>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    )
}
