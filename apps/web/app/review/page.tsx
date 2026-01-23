'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Brain, ArrowLeft, Loader2, Plus, Calendar, Target, Flame } from 'lucide-react'
import { flashcardStore, ReviewStats } from '@/lib/storage/flashcard-store'
import { LocalFlashcard } from '@/lib/storage/local-db'
import { FlashcardReview } from '@/components/srs/FlashcardReview'

type ViewMode = 'dashboard' | 'review' | 'complete'

export default function ReviewPage() {
  const router = useRouter()
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard')
  const [stats, setStats] = useState<ReviewStats | null>(null)
  const [streak, setStreak] = useState(0)
  const [dueCards, setDueCards] = useState<LocalFlashcard[]>([])
  const [reviewedCount, setReviewedCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    try {
      const [s, st, cards] = await Promise.all([
        flashcardStore.getStats(),
        flashcardStore.getStreak(),
        flashcardStore.getDueCards(50),
      ])
      setStats(s)
      setStreak(st)
      setDueCards(cards)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleStartReview = async () => {
    const cards = await flashcardStore.getDueCards(50)
    setDueCards(cards)
    setReviewedCount(0)
    setViewMode('review')
  }

  const handleCardReviewed = () => {
    setReviewedCount(c => c + 1)
  }

  const handleReviewComplete = async () => {
    setViewMode('complete')
    const [s, st] = await Promise.all([
      flashcardStore.getStats(),
      flashcardStore.getStreak(),
    ])
    setStats(s)
    setStreak(st)
  }

  const handleBackToDashboard = () => {
    setViewMode('dashboard')
    loadData()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
      </div>
    )
  }

  // Review mode
  if (viewMode === 'review') {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="border-b bg-white">
          <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
            <button
              onClick={handleBackToDashboard}
              className="flex items-center gap-2 text-gray-500 hover:text-gray-700 transition"
            >
              <ArrowLeft className="w-5 h-5" />
              返回
            </button>
            <div className="text-sm text-gray-500">
              已复习 {reviewedCount} 张
            </div>
          </div>
        </header>
        <div className="h-[calc(100vh-73px)]">
          <FlashcardReview
            cards={dueCards}
            onComplete={handleReviewComplete}
            onCardReviewed={handleCardReviewed}
          />
        </div>
      </div>
    )
  }

  // Complete mode
  if (viewMode === 'complete') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-6">🎉</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">今日复习完成!</h1>
          <p className="text-gray-500 mb-8">
            你已复习 {reviewedCount} 张卡片，连续学习 {streak} 天
          </p>
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-white border rounded-xl p-4 shadow-sm">
              <div className="text-2xl font-bold text-violet-600">{reviewedCount}</div>
              <div className="text-xs text-gray-500">今日复习</div>
            </div>
            <div className="bg-white border rounded-xl p-4 shadow-sm">
              <div className="text-2xl font-bold text-orange-500">{streak}</div>
              <div className="text-xs text-gray-500">连续天数</div>
            </div>
            <div className="bg-white border rounded-xl p-4 shadow-sm">
              <div className="text-2xl font-bold text-emerald-500">{stats?.averageRetention || 0}%</div>
              <div className="text-xs text-gray-500">记忆率</div>
            </div>
          </div>
          <button
            onClick={handleBackToDashboard}
            className="px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-xl transition"
          >
            返回仪表盘
          </button>
        </div>
      </div>
    )
  }

  // Dashboard mode
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Brain className="w-6 h-6 text-violet-500" />
            <h1 className="text-xl font-semibold text-gray-900">间隔复习</h1>
          </div>
          <button
            onClick={() => router.push('/learn')}
            className="text-sm text-gray-500 hover:text-gray-700 transition"
          >
            学习中心
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Hero Card */}
        <div className="bg-gradient-to-br from-violet-500 to-indigo-600 rounded-2xl p-8 mb-8 shadow-lg">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-medium text-white/80 mb-2">今日待复习</h2>
              <div className="flex items-end gap-2">
                <span className="text-5xl font-bold text-white">{stats?.dueToday || 0}</span>
                <span className="text-xl text-white/70 mb-1">张卡片</span>
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-2 mb-1">
                <Flame className="w-6 h-6 text-orange-300" />
                <span className="text-3xl font-bold text-white">{streak}</span>
              </div>
              <span className="text-sm text-white/60">连续学习天数</span>
            </div>
          </div>

          {stats && stats.dueToday > 0 && (
            <button
              onClick={handleStartReview}
              className="mt-6 w-full bg-white/20 hover:bg-white/30 backdrop-blur text-white font-medium py-4 rounded-xl transition"
            >
              开始复习
            </button>
          )}

          {stats && stats.dueToday === 0 && (
            <div className="mt-6 text-center text-white/70 py-4">
              今日没有待复习的卡片
            </div>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white border rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-2 text-gray-500 mb-2">
              <Target className="w-4 h-4" />
              <span className="text-sm">总卡片</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{stats?.totalCards || 0}</div>
          </div>
          <div className="bg-white border rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-2 text-blue-500 mb-2">
              <Plus className="w-4 h-4" />
              <span className="text-sm">新卡片</span>
            </div>
            <div className="text-2xl font-bold text-blue-600">{stats?.newCards || 0}</div>
          </div>
          <div className="bg-white border rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-2 text-yellow-500 mb-2">
              <Calendar className="w-4 h-4" />
              <span className="text-sm">学习中</span>
            </div>
            <div className="text-2xl font-bold text-yellow-600">{stats?.learningCards || 0}</div>
          </div>
          <div className="bg-white border rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-2 text-emerald-500 mb-2">
              <Brain className="w-4 h-4" />
              <span className="text-sm">已掌握</span>
            </div>
            <div className="text-2xl font-bold text-emerald-600">{stats?.reviewCards || 0}</div>
          </div>
        </div>

        {/* Retention Rate */}
        <div className="bg-white border rounded-xl p-6 mb-8 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-700 font-medium">记忆保持率</h3>
            <span className="text-2xl font-bold text-gray-900">{stats?.averageRetention || 0}%</span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                (stats?.averageRetention || 0) >= 90 ? 'bg-emerald-500' :
                (stats?.averageRetention || 0) >= 70 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${stats?.averageRetention || 0}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-400">
            <span>0%</span>
            <span>目标: 90%</span>
            <span>100%</span>
          </div>
        </div>

        {/* Empty State */}
        {stats?.totalCards === 0 && (
          <div className="text-center py-12 bg-white border rounded-xl shadow-sm">
            <Brain className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-gray-600 mb-2">还没有卡片</h3>
            <p className="text-sm text-gray-400 mb-4">
              在文档中选择文本，点击"创建卡片"开始学习
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
