'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Book, Edit3, Split, Sparkles, X, Layout } from 'lucide-react'
import { Editor } from '@/components/editor/Editor'
import { MaterialViewer } from '@/components/workpanel/MaterialViewer'
import { ChatSidebar } from '@/components/ai/ChatSidebar'
import { AppSidebar } from '@/components/layout/AppSidebar'
import { EditorProvider } from '@/contexts/EditorContext'
import { NoteExtractionProvider, useNoteExtraction } from '@/contexts/NoteExtractionContext'
import { useSession } from 'next-auth/react'

type ViewMode = 'read' | 'dual' | 'notes'

export default function EditorPage({ params }: { params: { id: string } }) {
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [viewMode, setViewMode] = useState<ViewMode>('dual')
    const [title, setTitle] = useState('开始内化...')
    const [materialTitle, setMaterialTitle] = useState('现代物理学导论')

    return (
        <EditorProvider>
            <NoteExtractionProviderWithUser documentId={params.id}>
                <div className="h-screen bg-white overflow-hidden selection:bg-violet-500/10 flex">
                    {/* 0. App Shell Navigation */}
                    <AppSidebar />

                    {/* Main Content Area (Offset by Sidebar) */}
                    <div className="flex-1 flex flex-col pl-[240px] h-full">

                        {/* 1. Context Header: The Paper Standard */}
                        <header className="h-16 border-b border-black/[0.04] flex items-center justify-between px-10 shrink-0 z-30 bg-white">
                            <div className="flex items-center gap-6">
                                <button
                                    onClick={() => window.history.back()}
                                    className="p-2 -ml-2 text-black/20 hover:text-black transition-colors rounded-full hover:bg-black/5"
                                >
                                    <Layout className="w-5 h-5 rotate-180" />
                                </button>
                                <div className="flex items-center gap-3 text-[11px] font-black uppercase tracking-widest text-black/20">
                                    <span className="max-w-[240px] truncate font-serif italic lowercase text-sm text-black/40">{materialTitle}</span>
                                    <span className="text-black/5">/</span>
                                    <span className="text-violet-600 lowercase italic font-serif text-sm">当前章节</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                <button
                                    onClick={() => setSidebarOpen(!sidebarOpen)}
                                    className={`p-2.5 rounded-xl transition-all ${sidebarOpen
                                        ? 'bg-violet-600 text-white shadow-lg shadow-violet-200'
                                        : 'text-black/20 hover:bg-black/5 hover:text-black'
                                        }`}
                                >
                                    <Sparkles className="w-5 h-5" />
                                </button>
                            </div>
                        </header>

                        {/* 2. The Internalization Pipeline */}
                        <div className="flex-1 flex overflow-hidden relative">

                            {/* Left: Reading Wing */}
                            {(viewMode === 'read' || viewMode === 'dual') && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className={`h-full border-r border-black/[0.02] bg-white ${viewMode === 'read' ? 'flex-1' : 'w-1/2 hidden lg:block'}`}
                                >
                                    <MaterialViewer title={materialTitle} />
                                </motion.div>
                            )}

                            {/* Right: Writing Wing (The Canvas) */}
                            {(viewMode === 'notes' || viewMode === 'dual') && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className={`h-full flex-1 overflow-y-auto custom-scrollbar bg-[#FCFCFD]`}
                                >
                                    <div className="max-w-3xl mx-auto p-12 lg:p-24 pb-96">
                                        <Editor
                                            documentId={params.id}
                                            title={title}
                                            setTitle={setTitle}
                                        />
                                    </div>
                                </motion.div>
                            )}

                            {/* AI Assistant Sidebar (Paper Drawer) */}
                            <AnimatePresence>
                                {sidebarOpen && (
                                    <motion.aside
                                        initial={{ x: 400, opacity: 0 }}
                                        animate={{ x: 0, opacity: 1 }}
                                        exit={{ x: 400, opacity: 0 }}
                                        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                                        className="w-[400px] h-full border-l border-black/[0.04] bg-white shrink-0 z-40"
                                    >
                                        <div className="h-full flex flex-col">
                                            <div className="p-8 pb-4 flex items-center justify-between">
                                                <div className="flex items-center gap-2 opacity-30">
                                                    <Sparkles className="w-4 h-4 text-violet-600" />
                                                    <h2 className="text-[10px] font-black uppercase tracking-widest">AI 建议</h2>
                                                </div>
                                                <button
                                                    onClick={() => setSidebarOpen(false)}
                                                    className="p-1 text-black/10 hover:text-black transition-colors"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                            <div className="flex-1 overflow-hidden">
                                                <ChatSidebar />
                                            </div>
                                        </div>
                                    </motion.aside>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* 3. Floating Mode Switcher (Zen Control) */}
                        <div className="fixed bottom-12 left-[calc(50%+120px)] -translate-x-1/2 z-50">
                            <div className="flex bg-black text-white p-1.5 rounded-[1.8rem] shadow-2xl items-center">
                                {[
                                    { id: 'read', icon: Book, label: '阅读' },
                                    { id: 'dual', icon: Split, label: '内化' },
                                    { id: 'notes', icon: Edit3, label: '记录' },
                                ].map((m) => (
                                    <button
                                        key={m.id}
                                        onClick={() => setViewMode(m.id as ViewMode)}
                                        className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === m.id ? 'bg-white text-black shadow-lg' : 'text-white/40 hover:text-white'
                                            }`}
                                    >
                                        <m.icon className="w-3.5 h-3.5" />
                                        <span className="hidden sm:inline-block">{m.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                    </div>
                </div>
            </NoteExtractionProviderWithUser>
        </EditorProvider>
    )
}

function NoteExtractionProviderWithUser({ children, documentId }: any) {
    return (
        <NoteExtractionProvider>
            <NoteExtractionInitializer>{children}</NoteExtractionInitializer>
        </NoteExtractionProvider>
    )
}

function NoteExtractionInitializer({ children }: any) {
    const { data: session } = useSession()
    const { setUserId } = useNoteExtraction()
    useEffect(() => {
        if (session?.user?.id) setUserId(session.user.id)
    }, [session?.user?.id, setUserId])
    return <>{children}</>
}
