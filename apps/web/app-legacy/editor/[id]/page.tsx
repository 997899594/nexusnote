'use client'

import { Editor } from '@/components/editor/Editor'
import { ChatSidebar } from '@/components/ai/ChatSidebar'
import { EditorProvider } from '@/contexts/EditorContext'
import { NoteExtractionProvider, useNoteExtraction } from '@/contexts/NoteExtractionContext'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { MessageSquare, X, PanelRightClose, Book, Edit3, Split, Layout, Sparkles } from 'lucide-react'
import { AdaptiveDock } from '@/components/layout/AdaptiveDock'
import { MaterialViewer } from '@/components/workpanel/MaterialViewer'
import { motion, AnimatePresence } from 'framer-motion'

type ViewMode = 'material' | 'dual' | 'notes'

export default function EditorPage({ params }: { params: { id: string } }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('dual')
  const [isVault, setIsVault] = useState(false)
  const [title, setTitle] = useState('思考中...')
  const [materialTitle, setMaterialTitle] = useState('Rust 语言系统级编程：高性能之道')

  useEffect(() => {
    if (window.innerWidth < 1024) setViewMode('notes')
  }, [])

  return (
    <EditorProvider>
      <NoteExtractionProviderWithUser documentId={params.id}>

        <div className="h-screen flex flex-col bg-white overflow-hidden relative">

          {/* 1. Paper Context Header */}
          <header className="h-16 border-b border-black/[0.03] flex items-center justify-between px-10 shrink-0 z-20">
            <div className="flex items-center gap-6">
              <button onClick={() => window.history.back()} className="p-2 -ml-2 text-black/20 hover:text-black transition-colors rounded-full hover:bg-black/5">
                <Layout className="w-5 h-5 rotate-180" />
              </button>
              <div className="flex items-center gap-3 text-[11px] font-black uppercase tracking-widest text-black/20">
                <span className="max-w-[200px] truncate">{materialTitle}</span>
                <span className="text-black/5">/</span>
                <span className="text-violet-600 lowercase italic font-serif text-sm">当前章节</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className={`p-2.5 rounded-xl transition-all ${sidebarOpen ? 'bg-violet-600 text-white shadow-lg shadow-violet-100' : 'text-black/20 hover:bg-black/5 hover:text-black'}`}
              >
                <Sparkles className="w-5 h-5" />
              </button>
            </div>
          </header>

          {/* 2. Internalization Pipeline (Flat Wings) */}
          <div className="flex-1 flex overflow-hidden relative">

            {/* Reading Wing */}
            {(viewMode === 'dual' || viewMode === 'material') && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`h-full border-r border-black/[0.02] ${viewMode === 'material' ? 'flex-1' : 'w-1/2'}`}
              >
                <MaterialViewer title={materialTitle} />
              </motion.div>
            )}

            {/* Writing Wing (Paper Canvas) */}
            {(viewMode === 'dual' || viewMode === 'notes') && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`h-full flex-1 overflow-y-auto custom-scrollbar bg-[#FCFCFD]`}
              >
                <div className="max-w-3xl mx-auto p-12 lg:p-24 pb-64">
                  <Editor
                    documentId={params.id}
                    isVault={isVault}
                    setIsVault={setIsVault}
                    title={title}
                    setTitle={setTitle}
                  />
                </div>
              </motion.div>
            )}

            {/* 3. Integrated AI Assistant Sidebar */}
            <AnimatePresence>
              {sidebarOpen && (
                <motion.aside
                  initial={{ x: 400, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: 400, opacity: 0 }}
                  className="w-[400px] h-full border-l border-black/[0.03] bg-white shrink-0 z-30"
                >
                  <div className="h-full flex flex-col">
                    <div className="p-8 pb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2 opacity-30">
                        <Sparkles className="w-4 h-4" />
                        <h2 className="text-[10px] font-black uppercase tracking-widest">AI 建议</h2>
                      </div>
                      <button onClick={() => setSidebarOpen(false)} className="p-1 text-black/10 hover:text-black transition-colors">
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

          {/* Minimal Mode Switcher (Floating Over Bottom) */}
          <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-50">
            <div className="flex bg-black text-white p-1.5 rounded-[1.5rem] shadow-2xl">
              {[
                { id: 'material', icon: Book, label: '阅读' },
                { id: 'dual', icon: Split, label: '内化' },
                { id: 'notes', icon: Edit3, label: '记录' },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setViewMode(m.id as ViewMode)}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === m.id ? 'bg-white text-black' : 'text-white/40 hover:text-white'
                    }`}
                >
                  <m.icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline-block">{m.label}</span>
                </button>
              ))}
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
