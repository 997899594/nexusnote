'use client'

import { useState, useEffect } from 'react'
import { History, ChevronRight, RotateCcw, GitCompare, Clock, Sparkles, Users, Save } from 'lucide-react'
import { DocumentSnapshot, snapshotStore, SnapshotTrigger } from '@/lib/storage'
import { DiffView } from './DiffView'
import * as Y from 'yjs'

interface TimelinePanelProps {
  documentId: string
  ydoc: Y.Doc | null
  isOpen: boolean
  onClose: () => void
  onRestore: (snapshot: DocumentSnapshot) => void
}

const triggerIcons: Record<SnapshotTrigger, React.ReactNode> = {
  auto: <Clock className="w-3 h-3" />,
  manual: <Save className="w-3 h-3" />,
  ai_edit: <Sparkles className="w-3 h-3" />,
  collab_join: <Users className="w-3 h-3" />,
  restore: <RotateCcw className="w-3 h-3" />,
}

const triggerLabels: Record<SnapshotTrigger, string> = {
  auto: '自动保存',
  manual: '手动保存',
  ai_edit: 'AI 编辑',
  collab_join: '协作者加入',
  restore: '版本恢复',
}

export function TimelinePanel({ documentId, ydoc, isOpen, onClose, onRestore }: TimelinePanelProps) {
  const [snapshots, setSnapshots] = useState<DocumentSnapshot[]>([])
  const [selectedSnapshot, setSelectedSnapshot] = useState<DocumentSnapshot | null>(null)
  const [compareSnapshot, setCompareSnapshot] = useState<DocumentSnapshot | null>(null)
  const [showDiff, setShowDiff] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isOpen && documentId) {
      loadSnapshots()
    }
  }, [isOpen, documentId])

  const loadSnapshots = async () => {
    setLoading(true)
    try {
      const snaps = await snapshotStore.getSnapshots(documentId)
      setSnapshots(snaps)
    } catch (error) {
      console.error('Failed to load snapshots:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateManualSnapshot = async () => {
    if (!ydoc) return
    await snapshotStore.createSnapshot(documentId, ydoc, 'manual')
    await loadSnapshots()
  }

  const handleRestore = async (snapshot: DocumentSnapshot) => {
    if (confirm('确定要恢复到这个版本吗？当前内容会被替换（但会自动备份）。')) {
      onRestore(snapshot)
      await loadSnapshots()
    }
  }

  const handleCompare = (snapshot: DocumentSnapshot) => {
    if (!selectedSnapshot) {
      setSelectedSnapshot(snapshot)
    } else if (selectedSnapshot.id === snapshot.id) {
      setSelectedSnapshot(null)
    } else {
      setCompareSnapshot(snapshot)
      setShowDiff(true)
    }
  }

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - timestamp

    if (diff < 60000) return '刚刚'
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
    if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`

    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const groupSnapshotsByDate = (snapshots: DocumentSnapshot[]) => {
    const groups: { date: string; snapshots: DocumentSnapshot[] }[] = []
    let currentDate = ''

    for (const snap of snapshots) {
      const date = new Date(snap.timestamp).toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })

      if (date !== currentDate) {
        currentDate = date
        groups.push({ date, snapshots: [] })
      }

      groups[groups.length - 1].snapshots.push(snap)
    }

    return groups
  }

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-y-0 right-0 w-80 bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 shadow-xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
            <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">时间轴</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded"
          >
            <ChevronRight className="w-5 h-5 text-zinc-500" />
          </button>
        </div>

        {/* Actions */}
        <div className="px-4 py-2 border-b border-zinc-200 dark:border-zinc-800">
          <button
            onClick={handleCreateManualSnapshot}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Save className="w-4 h-4" />
            保存当前版本
          </button>
          {selectedSnapshot && (
            <p className="mt-2 text-xs text-zinc-500 text-center">
              已选择一个版本，点击另一个版本进行对比
            </p>
          )}
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
            </div>
          ) : snapshots.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-zinc-500">
              <History className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm">暂无历史版本</p>
              <p className="text-xs mt-1">编辑文档时会自动保存</p>
            </div>
          ) : (
            <div className="py-2">
              {groupSnapshotsByDate(snapshots).map((group) => (
                <div key={group.date}>
                  <div className="px-4 py-2 text-xs font-medium text-zinc-500 dark:text-zinc-400 sticky top-0 bg-white dark:bg-zinc-900">
                    {group.date}
                  </div>
                  <div className="relative">
                    {/* Timeline line */}
                    <div className="absolute left-6 top-0 bottom-0 w-px bg-zinc-200 dark:bg-zinc-700" />

                    {group.snapshots.map((snapshot, index) => (
                      <div
                        key={snapshot.id}
                        className={`relative px-4 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer ${
                          selectedSnapshot?.id === snapshot.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                        }`}
                        onClick={() => handleCompare(snapshot)}
                      >
                        {/* Timeline dot */}
                        <div
                          className={`absolute left-5 top-4 w-3 h-3 rounded-full border-2 ${
                            index === 0 && group === groupSnapshotsByDate(snapshots)[0]
                              ? 'bg-blue-500 border-blue-500'
                              : 'bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-600'
                          }`}
                        />

                        <div className="ml-6">
                          <div className="flex items-center gap-2">
                            <span className="text-zinc-400 dark:text-zinc-500">
                              {triggerIcons[snapshot.trigger]}
                            </span>
                            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                              {triggerLabels[snapshot.trigger]}
                            </span>
                            <span className="text-xs text-zinc-400">
                              {formatTime(snapshot.timestamp)}
                            </span>
                          </div>

                          {snapshot.summary && (
                            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">
                              {snapshot.summary}
                            </p>
                          )}

                          <div className="mt-1 flex items-center gap-3 text-xs text-zinc-400">
                            <span>{snapshot.wordCount} 字</span>
                            {snapshot.diffFromPrevious && (
                              <>
                                {snapshot.diffFromPrevious.added > 0 && (
                                  <span className="text-green-500">
                                    +{snapshot.diffFromPrevious.added}
                                  </span>
                                )}
                                {snapshot.diffFromPrevious.removed > 0 && (
                                  <span className="text-red-500">
                                    -{snapshot.diffFromPrevious.removed}
                                  </span>
                                )}
                              </>
                            )}
                          </div>

                          {/* Action buttons */}
                          <div className="mt-2 flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleRestore(snapshot)
                              }}
                              className="flex items-center gap-1 px-2 py-1 text-xs text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded"
                            >
                              <RotateCcw className="w-3 h-3" />
                              恢复
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedSnapshot(snapshot)
                                setCompareSnapshot(null)
                                // Compare with current
                                setShowDiff(true)
                              }}
                              className="flex items-center gap-1 px-2 py-1 text-xs text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded"
                            >
                              <GitCompare className="w-3 h-3" />
                              对比当前
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Stats footer */}
        <div className="px-4 py-2 border-t border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500">
          共 {snapshots.length} 个版本
        </div>
      </div>

      {/* Diff View Modal */}
      {showDiff && selectedSnapshot && (
        <DiffView
          snapshot1={selectedSnapshot}
          snapshot2={compareSnapshot}
          currentYDoc={ydoc}
          onClose={() => {
            setShowDiff(false)
            setSelectedSnapshot(null)
            setCompareSnapshot(null)
          }}
        />
      )}
    </>
  )
}
