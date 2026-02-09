'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNoteExtractionOptional } from '@/lib/store'

interface GhostFlightProps {
  id: string
  content: string
  startRect: DOMRect
  onComplete: () => void
}

/**
 * GhostFlight - The flying text animation component
 *
 * Creates a visual "ghost" of the selected text that animates
 * from the selection position to the Knowledge sidebar tab.
 *
 * Target Selection Logic (solving the "bullseye" problem):
 * 1. Primary: Knowledge Tab button (always visible when sidebar is open)
 * 2. Fallback: Sidebar toggle button (when sidebar is collapsed)
 * 3. Last resort: Fixed position at top-right corner
 */
export function GhostFlight({ id, content, startRect, onComplete }: GhostFlightProps) {
  const noteExtraction = useNoteExtractionOptional()
  const [targetPosition, setTargetPosition] = useState({ x: 0, y: 0 })

  useEffect(() => {
    // Calculate target position based on available refs
    const knowledgeTabRef = noteExtraction?.knowledgeTabRef
    const sidebarToggleRef = noteExtraction?.sidebarToggleRef
    const isSidebarOpen = noteExtraction?.isSidebarOpen ?? true

    let targetRect: DOMRect | null = null

    if (isSidebarOpen && knowledgeTabRef?.current) {
      // Primary: Knowledge Tab button
      targetRect = knowledgeTabRef.current.getBoundingClientRect()
    } else if (sidebarToggleRef?.current) {
      // Fallback: Sidebar toggle
      targetRect = sidebarToggleRef.current.getBoundingClientRect()
    }

    if (targetRect) {
      setTargetPosition({
        x: targetRect.x + targetRect.width / 2,
        y: targetRect.y + targetRect.height / 2,
      })
    } else {
      // Last resort: fixed top-right position
      setTargetPosition({
        x: window.innerWidth - 60,
        y: 60,
      })
    }
  }, [noteExtraction])

  // Truncate content for display
  const displayText = content.length > 50 ? content.slice(0, 50) + '...' : content

  return (
    <motion.div
      key={id}
      className="fixed z-[9999] bg-yellow-100/90 dark:bg-yellow-900/90 backdrop-blur-sm rounded-lg px-3 py-2 text-sm shadow-lg pointer-events-none border border-yellow-200 dark:border-yellow-700"
      style={{
        maxWidth: 200,
      }}
      initial={{
        x: startRect.x,
        y: startRect.y,
        width: Math.min(startRect.width, 200),
        opacity: 1,
        scale: 1,
      }}
      animate={{
        x: targetPosition.x - 20,
        y: targetPosition.y - 10,
        width: 40,
        opacity: 0,
        scale: 0.2,
      }}
      transition={{
        type: 'spring',
        stiffness: 300,
        damping: 30,
        duration: 0.6,
      }}
      onAnimationComplete={onComplete}
    >
      <span className="text-yellow-800 dark:text-yellow-200 line-clamp-2">
        {displayText}
      </span>
    </motion.div>
  )
}

/**
 * GhostFlightContainer - Manages multiple flying ghosts
 *
 * Use this component at the app root level to render all active ghost flights.
 */
interface FlyingNote {
  id: string
  content: string
  startRect: DOMRect
}

export function GhostFlightContainer() {
  const noteExtraction = useNoteExtractionOptional()
  const [flyingNotes, setFlyingNotes] = useState<FlyingNote[]>([])

  // Listen for new flying notes from context
  useEffect(() => {
    if (!noteExtraction) return

    const pending = noteExtraction.pendingNotes.filter(n => n.status === 'flying')
    // Note: We track flying notes separately because we need startRect
    // The actual trigger happens in the extraction callback
  }, [noteExtraction?.pendingNotes])

  const handleComplete = (id: string) => {
    setFlyingNotes(prev => prev.filter(n => n.id !== id))
    noteExtraction?.clearFlyingNote(id)
  }

  // This function should be called when a note is extracted
  // Exported for use by the extraction trigger
  const addFlyingNote = (note: FlyingNote) => {
    setFlyingNotes(prev => [...prev, note])
  }

  return (
    <AnimatePresence>
      {flyingNotes.map(note => (
        <GhostFlight
          key={note.id}
          id={note.id}
          content={note.content}
          startRect={note.startRect}
          onComplete={() => handleComplete(note.id)}
        />
      ))}
    </AnimatePresence>
  )
}

// Re-export for external use
export type { FlyingNote }
