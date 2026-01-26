'use client'

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  ReactNode,
  RefObject,
} from 'react'
import useSWR from 'swr'

// ============================================
// Types
// ============================================
export interface ExtractedNote {
  id: string
  content: string
  status: 'flying' | 'processing' | 'classified'
  topicId?: string
  topicName?: string
}

export interface Topic {
  id: string
  name: string
  noteCount: number
  lastActiveAt: string | null
  recentNotes?: Array<{ id: string; content: string }>
}

export interface NoteSource {
  sourceType: 'document' | 'learning'
  documentId?: string
  chapterId?: string
  position: { from: number; to: number }
}

interface NoteExtractionContextValue {
  // Data
  pendingNotes: ExtractedNote[]
  topics: Topic[]
  isLoading: boolean

  // Actions
  extractNote: (content: string, rect: DOMRect, source: NoteSource) => void
  clearFlyingNote: (noteId: string) => void

  // Ghost flight target refs (for animation targeting)
  knowledgeTabRef: RefObject<HTMLButtonElement>
  sidebarToggleRef: RefObject<HTMLButtonElement>
  isSidebarOpen: boolean
  setIsSidebarOpen: (open: boolean) => void

  // Current user ID (should be set from auth context)
  userId: string | null
  setUserId: (id: string | null) => void
}

// ============================================
// Fetcher
// ============================================
const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to fetch')
  return res.json()
}

// ============================================
// Context
// ============================================
const NoteExtractionContext = createContext<NoteExtractionContextValue | null>(null)

// ============================================
// Provider
// ============================================
export function NoteExtractionProvider({ children }: { children: ReactNode }) {
  // User ID (should be provided by parent auth context)
  const [userId, setUserId] = useState<string | null>(null)

  // Optimistic UI state
  const [optimisticNotes, setOptimisticNotes] = useState<ExtractedNote[]>([])

  // Sidebar state for ghost flight targeting
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

  // Refs for ghost flight animation targets
  const knowledgeTabRef = useRef<HTMLButtonElement>(null)
  const sidebarToggleRef = useRef<HTMLButtonElement>(null)

  // Smart polling: faster when processing, slower when idle
  const hasProcessingNotes = optimisticNotes.some(n => n.status === 'processing')

  // Fetch topics from backend with SWR
  const { data: topicsData, isLoading } = useSWR(
    userId ? `/api/notes/topics?userId=${userId}` : null,
    fetcher,
    {
      refreshInterval: hasProcessingNotes ? 3000 : 30000,
      revalidateOnFocus: true,
    }
  )

  const topics: Topic[] = topicsData?.topics ?? []

  /**
   * Extract a note: trigger flying animation and send to backend
   */
  const extractNote = useCallback(
    async (content: string, rect: DOMRect, source: NoteSource) => {
      if (!userId) {
        console.warn('[NoteExtraction] No userId set, cannot extract')
        return
      }

      const tempId = crypto.randomUUID()

      // Step 1: Optimistic update - immediately show flying status
      setOptimisticNotes(prev => [
        ...prev,
        {
          id: tempId,
          content: content.slice(0, 200), // Truncate for display
          status: 'flying',
        },
      ])

      // Step 2: After animation completes (600ms), switch to processing
      setTimeout(() => {
        setOptimisticNotes(prev =>
          prev.map(n => (n.id === tempId ? { ...n, status: 'processing' } : n))
        )
      }, 600)

      // Step 3: Send request to backend with error rollback
      try {
        const response = await fetch('/api/notes/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content,
            userId,
            sourceType: source.sourceType,
            sourceDocumentId: source.documentId,
            sourceChapterId: source.chapterId,
            sourcePosition: source.position,
          }),
        })

        if (!response.ok) {
          throw new Error('Extract failed')
        }

        const { noteId } = await response.json()
        console.log(`[NoteExtraction] Created note: ${noteId}`)

        // Step 4: SWR polling will automatically fetch updated topics
        // Remove from optimistic notes after a delay (let SWR pick it up)
        setTimeout(() => {
          setOptimisticNotes(prev => prev.filter(n => n.id !== tempId))
        }, 5000)
      } catch (err) {
        console.error('[NoteExtraction] Failed to extract:', err)
        // Rollback: remove the optimistic note
        setOptimisticNotes(prev => prev.filter(n => n.id !== tempId))
        // TODO: Show toast notification
      }
    },
    [userId]
  )

  /**
   * Clear a flying note (called when animation completes)
   */
  const clearFlyingNote = useCallback((noteId: string) => {
    setOptimisticNotes(prev =>
      prev.map(n => (n.id === noteId && n.status === 'flying' ? { ...n, status: 'processing' } : n))
    )
  }, [])

  return (
    <NoteExtractionContext.Provider
      value={{
        pendingNotes: optimisticNotes,
        topics,
        isLoading,
        extractNote,
        clearFlyingNote,
        knowledgeTabRef,
        sidebarToggleRef,
        isSidebarOpen,
        setIsSidebarOpen,
        userId,
        setUserId,
      }}
    >
      {children}
    </NoteExtractionContext.Provider>
  )
}

// ============================================
// Hooks
// ============================================
export function useNoteExtraction() {
  const context = useContext(NoteExtractionContext)
  if (!context) {
    throw new Error('useNoteExtraction must be used within NoteExtractionProvider')
  }
  return context
}

export function useNoteExtractionOptional() {
  return useContext(NoteExtractionContext)
}
