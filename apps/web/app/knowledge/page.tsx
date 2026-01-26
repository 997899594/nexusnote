'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BookOpen,
  Sparkles,
  ChevronRight,
  Loader2,
  Home,
  TrendingUp,
  Clock
} from 'lucide-react'

// Dev user ID - replace with actual auth in production
const DEV_USER_ID = 'dev-user-001'

interface Topic {
  id: string
  name: string
  noteCount: number
  lastActiveAt: string
  recentNotes?: Array<{
    id: string
    content: string
    createdAt: string
  }>
}

const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to fetch')
  return res.json()
}

/**
 * TopicCard - A single topic card in the masonry layout
 */
function TopicCard({ topic, index }: { topic: Topic; index: number }) {
  const notePreview = topic.recentNotes?.[0]?.content || ''
  const hasMultipleNotes = topic.noteCount > 1

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className="break-inside-avoid mb-4"
    >
      <Link href={`/knowledge/${topic.id}`}>
        <div className="bg-card border rounded-xl p-4 hover:shadow-lg transition-all duration-200 cursor-pointer group">
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-base truncate group-hover:text-primary transition-colors">
                {topic.name}
              </h3>
              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <BookOpen className="w-3 h-3" />
                  {topic.noteCount} 条笔记
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatRelativeTime(topic.lastActiveAt)}
                </span>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>

          {/* Preview */}
          {notePreview && (
            <p className="text-sm text-muted-foreground line-clamp-3 mb-3">
              {notePreview}
            </p>
          )}

          {/* Heat bar */}
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-primary/60 to-primary rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(topic.noteCount * 10, 100)}%` }}
              transition={{ duration: 0.8, ease: 'easeOut', delay: index * 0.05 + 0.2 }}
            />
          </div>

          {/* More notes indicator */}
          {hasMultipleNotes && topic.recentNotes && topic.recentNotes.length > 1 && (
            <div className="mt-3 pt-3 border-t">
              <p className="text-xs text-muted-foreground line-clamp-1">
                {topic.recentNotes[1]?.content}
              </p>
            </div>
          )}
        </div>
      </Link>
    </motion.div>
  )
}

/**
 * StatsCard - Summary statistics card
 */
function StatsCard({
  icon: Icon,
  label,
  value,
  color
}: {
  icon: React.ElementType
  label: string
  value: string | number
  color: string
}) {
  return (
    <div className="bg-card border rounded-lg p-4 flex items-center gap-3">
      <div className={`p-2 rounded-lg ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  )
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
 * KnowledgePage - Main knowledge dashboard with masonry layout
 */
export default function KnowledgePage() {
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    // In production, get userId from auth
    setUserId(DEV_USER_ID)
  }, [])

  const { data, error, isLoading } = useSWR<{ topics: Topic[] }>(
    userId ? `/api/notes/topics?userId=${userId}` : null,
    fetcher,
    { refreshInterval: 30000 }
  )

  const topics = data?.topics || []
  const totalNotes = topics.reduce((sum, t) => sum + t.noteCount, 0)

  // Sort topics by activity
  const sortedTopics = [...topics].sort(
    (a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime()
  )

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b sticky top-0 bg-background/95 backdrop-blur-sm z-10">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-2 hover:bg-muted rounded-lg transition-colors"
              title="返回首页"
            >
              <Home className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <h1 className="font-semibold text-lg">知识库</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <StatsCard
            icon={BookOpen}
            label="知识主题"
            value={topics.length}
            color="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
          />
          <StatsCard
            icon={Sparkles}
            label="提取笔记"
            value={totalNotes}
            color="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
          />
          <StatsCard
            icon={TrendingUp}
            label="本周活跃"
            value={topics.filter(t => {
              const lastActive = new Date(t.lastActiveAt)
              const weekAgo = new Date()
              weekAgo.setDate(weekAgo.getDate() - 7)
              return lastActive > weekAgo
            }).length}
            color="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
          />
        </div>

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
        {!isLoading && !error && topics.length === 0 && (
          <div className="text-center py-20">
            <Sparkles className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
            <h2 className="text-xl font-semibold mb-2">还没有任何知识</h2>
            <p className="text-muted-foreground mb-6">
              在编辑器中选中文字，点击提取按钮开始积累知识
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
            >
              <Home className="w-4 h-4" />
              返回编辑器
            </Link>
          </div>
        )}

        {/* Topics Masonry Grid */}
        {!isLoading && !error && topics.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-semibold text-lg">所有主题</h2>
              <span className="text-sm text-muted-foreground">
                按最近活跃排序
              </span>
            </div>

            <div className="columns-1 md:columns-2 lg:columns-3 xl:columns-4 gap-4">
              <AnimatePresence>
                {sortedTopics.map((topic, index) => (
                  <TopicCard key={topic.id} topic={topic} index={index} />
                ))}
              </AnimatePresence>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
