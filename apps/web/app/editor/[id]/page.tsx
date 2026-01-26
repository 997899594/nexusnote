'use client'

import { Editor } from '@/components/editor/Editor'
import { ChatSidebar } from '@/components/ai/ChatSidebar'
import { EditorProvider } from '@/contexts/EditorContext'
import { NoteExtractionProvider, useNoteExtraction } from '@/contexts/NoteExtractionContext'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { MessageSquare, X, PanelRightClose, Book, Edit3, Split } from 'lucide-react'
import { AdaptiveDock } from '@/components/layout/AdaptiveDock'
import { MaterialViewer } from '@/components/workpanel/MaterialViewer'
import { motion, AnimatePresence } from 'framer-motion'

type ViewMode = 'material' | 'dual' | 'notes'

export default function EditorPage({ params }: { params: { id: string } }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('dual')
  const [isVault, setIsVault] = useState(false)
  const [title, setTitle] = useState('加载中...')
  const [materialTitle, setMaterialTitle] = useState('Rust 语言系统级编程：高性能之道')

  useEffect(() => {
    if (window.innerWidth < 1024) setViewMode('notes')
  }, [])

  return (
    <EditorProvider>
      <NoteExtractionProviderWithUser documentId={params.id}>

        <AdaptiveDock isVault={isVault} onToggleVault={() => { }} />

        <div className="h-screen flex overflow-hidden relative">

          {/* Mode Switcher */}
          <div className="fixed top-6 left-1/2 -track-x-1/2 z-[100] -translate-x-1/2">
            <div className="flex bg-white/10 dark:bg-black/20 backdrop-blur-2xl p-1 rounded-2xl border border-white/10 shadow-lg">
              {[
                { id: 'material', icon: Book, label: '资料' },
                { id: 'dual', icon: Split, label: '分屏' },
                { id: 'notes', icon: Edit3, label: '笔记' },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setViewMode(m.id as ViewMode)}
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-[11px] font-bold transition-all ${viewMode === m.id ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-white/5'
                    }`}
                >
                  <m.icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline-block">{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Main Container */}
          <div className="flex-1 flex min-w-0 h-full p-4 lg:p-6 gap-6 pt-20">

            {/* Left: Reading */}
            <AnimatePresence mode="wait">
              {(viewMode === 'dual' || viewMode === 'material') && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className={`h-full ${viewMode === 'material' ? 'flex-1' : 'w-1/2 hidden lg:block'}`}
                >
                  <MaterialViewer title={materialTitle} />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Right: Writing */}
            <AnimatePresence mode="wait">
              {(viewMode === 'dual' || viewMode === 'notes') && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className={`h-full flex flex-col ${viewMode === 'notes' ? 'flex-1 max-w-4xl mx-auto' : 'w-1/2'} overflow-y-auto custom-scrollbar glass-panel rounded-3xl border-white/5 bg-black/[0.01] dark:bg-white/[0.01] shadow-sm`}
                >
                  <div className="p-8 lg:p-12 pb-64">
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
            </AnimatePresence>
          </div>

          {/* AI Assistant Toggle */}
          <div className="fixed top-6 right-6 z-[100] hidden md:block">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="w-10 h-10 glass-panel rounded-xl flex items-center justify-center hover:bg-muted transition-all text-muted-foreground border-white/10 dark:border-white/5"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <MessageSquare className="w-5 h-5" />}
            </button>
          </div>

          {/* AI Sidebar */}
          <AnimatePresence>
            {sidebarOpen && (
              <motion.aside
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed inset-y-0 right-0 w-[400px] z-[200] p-4 h-full"
              >
                <div className="glass-panel h-full flex flex-col rounded-3xl shadow-xl overflow-hidden bg-white/80 dark:bg-neutral-900/80 backdrop-blur-3xl border-white/10">
                  <div className="p-6 pb-2 flex items-center justify-between border-b border-black/5 dark:border-white/10">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-violet-500" />
                      <h2 className="text-sm font-bold tracking-tight">AI 助手</h2>
                    </div>
                    <button
                      onClick={() => setSidebarOpen(false)}
                      className="p-1 hover:bg-muted rounded-lg transition"
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

        <style jsx global>{`
      .custom-scrollbar::-webkit-scrollbar { width: 4px; }
      .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
      .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.05); border-radius: 10px; }
      .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); }
    `}</style>
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
