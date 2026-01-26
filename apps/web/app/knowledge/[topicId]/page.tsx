'use client'

import { useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import useSWR from 'swr'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft,
  BookOpen,
  ExternalLink,
  Loader2,
  Sparkles,
  FileText,
  GraduationCap,
  Clock,
  Hash
} from 'lucide-react'

interface ExtractedNote {
  id: string
  content: string
  sourceType: 'document' | 'learning'
  sourceDocumentId?: string
  sourceChapterId?: string
  sourcePosition?: { from: number; to: number }
  createdAt: string
}

interface Topic {
  id: string
  name: string
  noteCount: number
  lastActiveAt: string
}

const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to fetch')
  return res.json()
}

/**
 * Format relative time
 */
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return '刚刚'
  if (diffMins < 60) return `${diffMins} 分钟前`
  if (diffHours < 24) return `${diffHours} 小时前`
  if (diffDays < 7) return `${diffDays} 天前`
  return date.toLocaleDateString('zh-CN')
}

/**
 * NoteCard - A single note card
 */
function NoteCard({ note, index }: { note: ExtractedNote; index: number }) {
  const isFromDocument = note.sourceType === 'document'
  const sourceUrl = isFromDocument && note.sourceDocumentId
    ? `/editor/${note.sourceDocumentId}`
    : note.sourceChapterId
      ? `/learn/${note.sourceChapterId}`
      : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className="bg-card border rounded-lg p-4 hover:shadow-md transition-shadow"
    >
      {/* Content */}
      <p className="text-sm leading-relaxed mb-4">{note.content}</p>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          {/* Source type */}
          <span className="flex items-center gap-1">
            {isFromDocument ? (
              <>
                <FileText className="w-3 h-3" />
                文档
              </>
            ) : (
              <>
                <GraduationCap className="w-3 h-3" />
                学习
              </>
            )}
          </span>

          {/* Time */}
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatRelativeTime(note.createdAt)}
          </span>
        </div>

        {/* Source link */}
        {sourceUrl && (
          <Link
            href={sourceUrl}
            className="flex items-center gap-1 hover:text-primary transition-colors"
            title="查看原文"
          >
            <ExternalLink className="w-3 h-3" />
            原文
          </Link>
        )}
      </div>
    </motion.div>
  )
}

/**
 * TopicDetailPage - Shows all notes in a topic with AI summary
 */
export default function TopicDetailPage({ params }: { params: { topicId: string } }) {
  const { topicId } = params
  const { data: session, status } = useSession()
  const userId = session?.user?.id ?? null

  // Redirect to login if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      window.location.href = '/login'
    }
  }, [status])

  // Fetch topic info
  const { data: topicsData } = useSWR<{ topics: Topic[] }>(
    userId ? `/api/notes/topics?userId=${userId}` : null,
    fetcher
  )

  // Fetch notes for this topic
  const { data: notesData, error, isLoading } = useSWR<{ notes: ExtractedNote[] }>(
    topicId ? `/api/notes/topics/${topicId}/notes` : null,
    fetcher
  )

  // Find current topic from topics list
  const topic = useMemo(() => {
    return topicsData?.topics.find(t => t.id === topicId)
  }, [topicsData, topicId])

  const notes = notesData?.notes || []

  // Sort notes by creation time (newest first)
  const sortedNotes = useMemo(() => {
    return [...notes].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  }, [notes])

  // Stats
  const documentNotes = notes.filter(n => n.sourceType === 'document').length
  const learningNotes = notes.filter(n => n.sourceType === 'learning').length

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b sticky top-0 bg-background/95 backdrop-blur-sm z-10">
        <div className="container mx-auto px-4 h-14 flex items-center gap-3">
          <Link
            href="/knowledge"
            className="p-2 hover:bg-muted rounded-lg transition-colors"
            title="返回知识库"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h1 className="font-semibold text-lg truncate">
              {topic?.name || '加载中...'}
            </h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        {/* Topic Summary */}
        {topic && (
          <div className="bg-card border rounded-xl p-6 mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Hash className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold">{topic.name}</h2>
                <p className="text-sm text-muted-foreground">
                  共 {topic.noteCount} 条笔记 · 最近活跃 {formatRelativeTime(topic.lastActiveAt)}
                </p>
              </div>
            </div>

            {/* Stats breakdown */}
            <div className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <FileText className="w-4 h-4" />
                {documentNotes} 条来自文档
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <GraduationCap className="w-4 h-4" />
                {learningNotes} 条来自学习
              </span>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="text-center py-20">
            <p className="text-destructive mb-2">加载失败</p>
            <p className="text-sm text-muted-foreground">{error.message}</p>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && notes.length === 0 && (
          <div className="text-center py-20">
            <BookOpen className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
            <h2 className="text-xl font-semibold mb-2">暂无笔记</h2>
            <p className="text-muted-foreground">
              这个主题下还没有任何笔记
            </p>
          </div>
        )}

        {/* Notes List */}
        {!isLoading && !error && notes.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold">所有笔记</h3>
              <span className="text-sm text-muted-foreground">
                按时间排序
              </span>
            </div>

            <div className="space-y-4">
              <AnimatePresence>
                {sortedNotes.map((note, index) => (
                  <NoteCard key={note.id} note={note} index={index} />
                ))}
              </AnimatePresence>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
