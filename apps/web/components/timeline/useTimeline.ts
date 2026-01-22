'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import * as Y from 'yjs'
import { DocumentSnapshot, snapshotStore, SnapshotTrigger } from '@/lib/storage'

interface UseTimelineOptions {
  documentId: string
  ydoc: Y.Doc | null
  autoSnapshotInterval?: number // ms, default 5 minutes
  enabled?: boolean
}

interface UseTimelineReturn {
  snapshots: DocumentSnapshot[]
  isLoading: boolean
  createSnapshot: (trigger?: SnapshotTrigger, summary?: string) => Promise<DocumentSnapshot | null>
  restoreSnapshot: (snapshotId: string) => Promise<boolean>
  deleteSnapshot: (snapshotId: string) => Promise<void>
  refreshSnapshots: () => Promise<void>
  stats: {
    total: number
    lastSnapshotTime: number | null
  }
}

export function useTimeline({
  documentId,
  ydoc,
  autoSnapshotInterval = 5 * 60 * 1000,
  enabled = true,
}: UseTimelineOptions): UseTimelineReturn {
  const [snapshots, setSnapshots] = useState<DocumentSnapshot[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const autoSnapshotTimerRef = useRef<NodeJS.Timeout | null>(null)
  const lastActivityRef = useRef<number>(Date.now())

  // Load snapshots
  const refreshSnapshots = useCallback(async () => {
    if (!documentId) return
    setIsLoading(true)
    try {
      const snaps = await snapshotStore.getSnapshots(documentId)
      setSnapshots(snaps)
    } catch (error) {
      console.error('[useTimeline] Failed to load snapshots:', error)
    } finally {
      setIsLoading(false)
    }
  }, [documentId])

  // Create snapshot
  const createSnapshot = useCallback(
    async (trigger: SnapshotTrigger = 'manual', summary?: string) => {
      if (!ydoc || !documentId) return null
      try {
        const snapshot = await snapshotStore.createSnapshot(documentId, ydoc, trigger, summary)
        if (snapshot) {
          setSnapshots((prev) => [snapshot, ...prev])
        }
        return snapshot
      } catch (error) {
        console.error('[useTimeline] Failed to create snapshot:', error)
        return null
      }
    },
    [documentId, ydoc]
  )

  // Restore snapshot
  const restoreSnapshot = useCallback(
    async (snapshotId: string) => {
      if (!ydoc || !documentId) return false
      try {
        const success = await snapshotStore.restoreSnapshot(snapshotId, ydoc)
        if (success) {
          await refreshSnapshots()
        }
        return success
      } catch (error) {
        console.error('[useTimeline] Failed to restore snapshot:', error)
        return false
      }
    },
    [documentId, ydoc, refreshSnapshots]
  )

  // Delete snapshot
  const deleteSnapshot = useCallback(
    async (snapshotId: string) => {
      try {
        await snapshotStore.deleteSnapshot(snapshotId)
        setSnapshots((prev) => prev.filter((s) => s.id !== snapshotId))
      } catch (error) {
        console.error('[useTimeline] Failed to delete snapshot:', error)
      }
    },
    []
  )

  // Initial load
  useEffect(() => {
    if (enabled && documentId) {
      refreshSnapshots()
    }
  }, [enabled, documentId, refreshSnapshots])

  // Auto-snapshot on interval
  useEffect(() => {
    if (!enabled || !ydoc || !documentId || autoSnapshotInterval <= 0) return

    const checkAndSnapshot = async () => {
      // Only snapshot if there was recent activity
      const timeSinceActivity = Date.now() - lastActivityRef.current
      if (timeSinceActivity < autoSnapshotInterval) {
        if (snapshotStore.shouldAutoSnapshot(documentId)) {
          await createSnapshot('auto')
        }
      }
    }

    autoSnapshotTimerRef.current = setInterval(checkAndSnapshot, autoSnapshotInterval)

    return () => {
      if (autoSnapshotTimerRef.current) {
        clearInterval(autoSnapshotTimerRef.current)
      }
    }
  }, [enabled, ydoc, documentId, autoSnapshotInterval, createSnapshot])

  // Track activity
  useEffect(() => {
    if (!ydoc) return

    const handleUpdate = () => {
      lastActivityRef.current = Date.now()
    }

    ydoc.on('update', handleUpdate)
    return () => {
      ydoc.off('update', handleUpdate)
    }
  }, [ydoc])

  // Compute stats
  const stats = {
    total: snapshots.length,
    lastSnapshotTime: snapshots.length > 0 ? snapshots[0].timestamp : null,
  }

  return {
    snapshots,
    isLoading,
    createSnapshot,
    restoreSnapshot,
    deleteSnapshot,
    refreshSnapshots,
    stats,
  }
}

/**
 * Hook for AI edit snapshots
 * Call this after AI edits are applied
 */
export function useAIEditSnapshot(documentId: string, ydoc: Y.Doc | null) {
  const createAISnapshot = useCallback(
    async (summary: string) => {
      if (!ydoc || !documentId) return null
      return snapshotStore.createSnapshot(documentId, ydoc, 'ai_edit', summary)
    },
    [documentId, ydoc]
  )

  return { createAISnapshot }
}

/**
 * Hook for collaboration snapshots
 * Call this when collaborators join
 */
export function useCollabSnapshot(documentId: string, ydoc: Y.Doc | null) {
  const createCollabSnapshot = useCallback(
    async () => {
      if (!ydoc || !documentId) return null
      return snapshotStore.createSnapshot(documentId, ydoc, 'collab_join', '协作者加入')
    },
    [documentId, ydoc]
  )

  return { createCollabSnapshot }
}
