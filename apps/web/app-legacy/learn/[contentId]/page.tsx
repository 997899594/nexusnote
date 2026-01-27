'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, BookOpen, Clock, CheckCircle2, Circle, Play, Trophy, Trash2 } from 'lucide-react'
import {
  learningStore,
  LocalLearningContent,
  LocalLearningChapter,
  LocalLearningProgress,
} from '@/lib/storage'

interface CourseDetailProps {
  params: { contentId: string }
}

export default function CourseDetailPage({ params }: CourseDetailProps) {
  const router = useRouter()
  const [content, setContent] = useState<LocalLearningContent | null>(null)
  const [chapters, setChapters] = useState<LocalLearningChapter[]>([])
  const [progress, setProgress] = useState<LocalLearningProgress | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadCourse()
  }, [params.contentId])

  const loadCourse = async () => {
    setLoading(true)
    try {
      const [contentData, chaptersData, progressData] = await Promise.all([
        learningStore.getContent(params.contentId),
        learningStore.getChapters(params.contentId),
        learningStore.getProgress(params.contentId),
      ])

      if (!contentData) {
        router.push('/learn')
        return
      }

      setContent(contentData)
      setChapters(chaptersData)
      setProgress(progressData || null)
    } catch (error) {
      console.error('Failed to load course:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleStartChapter = async (chapterIndex: number) => {
    await learningStore.updateCurrentChapter(params.contentId, chapterIndex)
    router.push(`/learn/${params.contentId}/${chapterIndex}`)
  }

  const handleDeleteCourse = async () => {
    if (!confirm('确定删除此课程？所有学习进度将丢失。')) return

    await learningStore.deleteContent(params.contentId)
    router.push('/learn')
  }

  const isChapterCompleted = (chapterIndex: number) => {
    return progress?.completedChapters.includes(chapterIndex) || false
  }

  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${minutes}分钟`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`
  }

  const getDifficultyLabel = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return '入门'
      case 'intermediate': return '进阶'
      case 'advanced': return '高级'
      default: return difficulty
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-zinc-600 border-t-violet-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (!content) return null

  const completedCount = progress?.completedChapters.length || 0
  const progressPercent = Math.round((completedCount / content.totalChapters) * 100)

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => router.push('/learn')}
            className="flex items-center gap-2 text-zinc-400 hover:text-zinc-200 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            返回课程列表
          </button>
          <button
            onClick={handleDeleteCourse}
            className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
            title="删除课程"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Course Info */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4 mb-4">
            <h1 className="text-2xl font-bold text-zinc-100">{content.title}</h1>
            <span className="px-3 py-1 text-xs font-medium bg-violet-500/10 text-violet-400 rounded-full">
              {getDifficultyLabel(content.difficulty)}
            </span>
          </div>

          {content.summary && (
            <p className="text-zinc-400 mb-6">{content.summary}</p>
          )}

          <div className="flex items-center gap-6 text-sm text-zinc-500">
            <span className="flex items-center gap-1.5">
              <BookOpen className="w-4 h-4" />
              {content.totalChapters} 章节
            </span>
            {content.estimatedMinutes && (
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                {formatTime(content.estimatedMinutes)}
              </span>
            )}
            {progress && progress.totalTimeSpent > 0 && (
              <span className="flex items-center gap-1.5">
                <Trophy className="w-4 h-4 text-amber-500" />
                已学 {formatTime(progress.totalTimeSpent)}
              </span>
            )}
          </div>
        </div>

        {/* Progress Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 mb-8">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-zinc-400">学习进度</span>
            <span className="text-sm font-medium text-violet-400">
              {completedCount} / {content.totalChapters} 章节完成
            </span>
          </div>
          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden mb-2">
            <div
              className="h-full bg-gradient-to-r from-violet-600 to-violet-400 rounded-full transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="text-right text-xs text-zinc-600">{progressPercent}% 完成</div>
        </div>

        {/* Chapters List */}
        <div className="space-y-3">
          <h2 className="text-lg font-medium text-zinc-200 mb-4">课程目录</h2>

          {chapters.map((chapter, index) => {
            const completed = isChapterCompleted(index)
            const isCurrent = progress?.currentChapter === index

            return (
              <div
                key={chapter.id}
                onClick={() => handleStartChapter(index)}
                className={`
                  group flex items-start gap-4 p-4 rounded-xl border cursor-pointer transition
                  ${completed
                    ? 'bg-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/40'
                    : isCurrent
                      ? 'bg-violet-500/5 border-violet-500/30 hover:border-violet-500/50'
                      : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
                  }
                `}
              >
                {/* Status Icon */}
                <div className={`
                  mt-0.5 flex-shrink-0
                  ${completed ? 'text-emerald-500' : isCurrent ? 'text-violet-500' : 'text-zinc-600'}
                `}>
                  {completed ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : isCurrent ? (
                    <Play className="w-5 h-5" />
                  ) : (
                    <Circle className="w-5 h-5" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-zinc-600">第 {index + 1} 章</span>
                  </div>
                  <h3 className={`
                    font-medium mb-1
                    ${completed ? 'text-emerald-400' : isCurrent ? 'text-violet-300' : 'text-zinc-200'}
                    group-hover:${completed ? 'text-emerald-300' : isCurrent ? 'text-violet-200' : 'text-white'}
                  `}>
                    {chapter.title}
                  </h3>
                  {chapter.summary && (
                    <p className="text-sm text-zinc-500 line-clamp-2">{chapter.summary}</p>
                  )}
                  {chapter.keyPoints.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {chapter.keyPoints.slice(0, 3).map((point, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 text-xs bg-zinc-800 text-zinc-500 rounded"
                        >
                          {point}
                        </span>
                      ))}
                      {chapter.keyPoints.length > 3 && (
                        <span className="text-xs text-zinc-600">+{chapter.keyPoints.length - 3}</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Continue Button */}
                <div className={`
                  flex-shrink-0 opacity-0 group-hover:opacity-100 transition
                  ${isCurrent ? 'opacity-100' : ''}
                `}>
                  <span className={`
                    px-3 py-1.5 text-xs font-medium rounded-lg
                    ${completed
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'bg-violet-500/10 text-violet-400'
                    }
                  `}>
                    {completed ? '复习' : isCurrent ? '继续学习' : '开始学习'}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
