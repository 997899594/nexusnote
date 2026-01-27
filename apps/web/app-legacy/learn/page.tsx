'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, BookOpen, Clock, Trophy, Sparkles, Loader2 } from 'lucide-react'
import { learningStore, LocalLearningContent, LocalLearningProgress } from '@/lib/storage'

interface CourseWithProgress extends LocalLearningContent {
  progress?: LocalLearningProgress
}

export default function LearnPage() {
  const router = useRouter()
  const [courses, setCourses] = useState<CourseWithProgress[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [learningGoal, setLearningGoal] = useState('')
  const [stats, setStats] = useState({
    totalCourses: 0,
    completedCourses: 0,
    totalTimeSpent: 0,
    averageMastery: 0,
  })

  useEffect(() => {
    loadCourses()
  }, [])

  const loadCourses = async () => {
    setLoading(true)
    try {
      const contents = await learningStore.getAllContents()
      const coursesWithProgress: CourseWithProgress[] = []

      for (const content of contents) {
        const progress = await learningStore.getProgress(content.id)
        coursesWithProgress.push({ ...content, progress })
      }

      // Sort by last accessed
      coursesWithProgress.sort((a, b) => {
        const aTime = a.progress?.lastAccessedAt || a.createdAt
        const bTime = b.progress?.lastAccessedAt || b.createdAt
        return bTime - aTime
      })

      setCourses(coursesWithProgress)
      setStats(await learningStore.getStats())
    } catch (error) {
      console.error('Failed to load courses:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateCourse = async () => {
    if (!learningGoal.trim()) return

    setCreating(true)
    try {
      // Call AI to generate course outline
      const response = await fetch('/api/learn/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal: learningGoal }),
      })

      if (!response.ok) throw new Error('Failed to generate course')

      const outline = await response.json()
      const content = await learningStore.createFromOutline(outline)

      setShowCreateModal(false)
      setLearningGoal('')
      router.push(`/learn/${content.id}`)
    } catch (error) {
      console.error('Failed to create course:', error)
      alert('课程生成失败，请重试')
    } finally {
      setCreating(false)
    }
  }

  const getDifficultyLabel = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return '入门'
      case 'intermediate': return '进阶'
      case 'advanced': return '高级'
      default: return difficulty
    }
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'text-emerald-500 bg-emerald-500/10'
      case 'intermediate': return 'text-blue-500 bg-blue-500/10'
      case 'advanced': return 'text-purple-500 bg-purple-500/10'
      default: return 'text-zinc-500 bg-zinc-500/10'
    }
  }

  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${minutes}分钟`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-800">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpen className="w-6 h-6 text-violet-500" />
            <h1 className="text-xl font-semibold text-zinc-100">学习中心</h1>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition"
          >
            <Sparkles className="w-4 h-4" />
            AI 生成课程
          </button>
        </div>
      </header>

      {/* Stats */}
      <div className="max-w-6xl mx-auto px-6 py-6">
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="text-2xl font-bold text-zinc-100">{stats.totalCourses}</div>
            <div className="text-sm text-zinc-500">课程总数</div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="text-2xl font-bold text-emerald-500">{stats.completedCourses}</div>
            <div className="text-sm text-zinc-500">已完成</div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="text-2xl font-bold text-zinc-100">{formatTime(stats.totalTimeSpent)}</div>
            <div className="text-sm text-zinc-500">学习时长</div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="text-2xl font-bold text-violet-500">{stats.averageMastery}%</div>
            <div className="text-sm text-zinc-500">平均掌握度</div>
          </div>
        </div>
      </div>

      {/* Course List */}
      <div className="max-w-6xl mx-auto px-6 pb-12">
        <h2 className="text-lg font-medium text-zinc-200 mb-4">我的课程</h2>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-6 h-6 text-zinc-500 animate-spin" />
          </div>
        ) : courses.length === 0 ? (
          <div className="text-center py-16 bg-zinc-900/50 border border-zinc-800 rounded-xl">
            <BookOpen className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
            <h3 className="text-zinc-400 mb-2">还没有课程</h3>
            <p className="text-sm text-zinc-600 mb-4">输入你想学习的内容，AI 会为你生成个性化课程</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition"
            >
              <Plus className="w-4 h-4" />
              创建第一个课程
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {courses.map((course) => (
              <div
                key={course.id}
                onClick={() => router.push(`/learn/${course.id}`)}
                className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 transition cursor-pointer group"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-medium text-zinc-200 group-hover:text-white transition line-clamp-2">
                    {course.title}
                  </h3>
                  <span className={`px-2 py-0.5 text-xs rounded-full ${getDifficultyColor(course.difficulty)}`}>
                    {getDifficultyLabel(course.difficulty)}
                  </span>
                </div>

                {course.summary && (
                  <p className="text-sm text-zinc-500 mb-4 line-clamp-2">{course.summary}</p>
                )}

                <div className="flex items-center justify-between text-xs text-zinc-600">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <BookOpen className="w-3.5 h-3.5" />
                      {course.totalChapters} 章节
                    </span>
                    {course.estimatedMinutes && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {formatTime(course.estimatedMinutes)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                {course.progress && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-zinc-500">进度</span>
                      <span className="text-violet-500">{course.progress.masteryLevel}%</span>
                    </div>
                    <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-violet-500 rounded-full transition-all"
                        style={{ width: `${course.progress.masteryLevel}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Course Modal */}
      {showCreateModal && (
        <>
          <div
            className="fixed inset-0 bg-black/60 z-40"
            onClick={() => !creating && setShowCreateModal(false)}
          />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-violet-500/10 rounded-xl flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-violet-500" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-zinc-100">AI 生成课程</h2>
                  <p className="text-sm text-zinc-500">输入你想学习的内容</p>
                </div>
              </div>

              <textarea
                value={learningGoal}
                onChange={(e) => setLearningGoal(e.target.value)}
                placeholder="例如：学习 React 进阶，包括 Hooks、性能优化、设计模式..."
                className="w-full h-32 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-200 placeholder:text-zinc-600 resize-none focus:outline-none focus:border-violet-500 transition"
                disabled={creating}
              />

              <div className="flex items-center justify-end gap-3 mt-4">
                <button
                  onClick={() => setShowCreateModal(false)}
                  disabled={creating}
                  className="px-4 py-2 text-zinc-400 hover:text-zinc-200 transition disabled:opacity-50"
                >
                  取消
                </button>
                <button
                  onClick={handleCreateCourse}
                  disabled={creating || !learningGoal.trim()}
                  className="flex items-center gap-2 px-5 py-2 bg-violet-600 hover:bg-violet-500 disabled:bg-violet-600/50 text-white rounded-lg transition"
                >
                  {creating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      生成中...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      生成课程
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
