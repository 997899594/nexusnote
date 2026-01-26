'use client'

import { Editor } from '@/components/editor/Editor'
import { ChatSidebar } from '@/components/ai/ChatSidebar'
import { EditorProvider } from '@/contexts/EditorContext'
import { NoteExtractionProvider, useNoteExtraction } from '@/contexts/NoteExtractionContext'
import { useState, useEffect } from 'react'
import { MessageSquare, X } from 'lucide-react'

// Dev user ID - replace with actual auth in production
const DEV_USER_ID = 'dev-user-001'

export default function EditorPage({ params }: { params: { id: string } }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <EditorProvider>
    <NoteExtractionProviderWithUser documentId={params.id}>
    <div className="h-screen flex overflow-hidden">
      {/* Main Editor Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-14 border-b flex items-center justify-between px-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            <h1 className="font-semibold">NexusNote</h1>
            <span className="text-muted-foreground text-sm">/ {params.id}</span>
          </div>

          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-muted rounded-lg transition"
            title="AI Assistant"
          >
            <MessageSquare className="w-5 h-5" />
          </button>
        </header>

        {/* Editor */}
        <main className="flex-1 overflow-auto min-h-0">
          <div className="max-w-3xl mx-auto py-8 px-4">
            <Editor documentId={params.id} />
          </div>
        </main>
      </div>

      {/* AI Sidebar */}
      {sidebarOpen && (
        <aside className="w-96 border-l flex flex-col bg-background flex-shrink-0">
          <div className="h-14 border-b flex items-center justify-between px-4 flex-shrink-0">
            <h2 className="font-semibold">AI Assistant</h2>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-1 hover:bg-muted rounded transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <ChatSidebar />
        </aside>
      )}
    </div>
    </NoteExtractionProviderWithUser>
    </EditorProvider>
  )
}

/**
 * Wrapper component to initialize NoteExtractionProvider with userId
 */
function NoteExtractionProviderWithUser({
  children,
  documentId,
}: {
  children: React.ReactNode
  documentId: string
}) {
  return (
    <NoteExtractionProvider>
      <NoteExtractionInitializer>
        {children}
      </NoteExtractionInitializer>
    </NoteExtractionProvider>
  )
}

/**
 * Inner component to set userId after provider is mounted
 */
function NoteExtractionInitializer({
  children,
}: {
  children: React.ReactNode
}) {
  const { setUserId } = useNoteExtraction()

  useEffect(() => {
    // Set dev user ID - replace with actual auth in production
    setUserId(DEV_USER_ID)
  }, [setUserId])

  return <>{children}</>
}
