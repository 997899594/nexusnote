'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  MessageSquare,
  X,
  Lightbulb,
  Clock,
  Loader2,
  Sparkles,
} from 'lucide-react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Collaboration from '@tiptap/extension-collaboration'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import { TaskList } from '@tiptap/extension-task-list'
import { TaskItem } from '@tiptap/extension-task-item'
import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'
import {
  learningStore,
  LocalLearningContent,
  LocalLearningChapter,
  LocalLearningProgress,
} from '@/lib/storage'
import { ChatSidebar } from '@/components/ai/ChatSidebar'
import { EditorProvider } from '@/contexts/EditorContext'
import { Callout } from '@/components/editor/extensions/callout'
import { Collapsible } from '@/components/editor/extensions/collapsible'

interface ChapterReaderProps {
  params: { contentId: string; chapterIndex: string }
}

export default function ChapterReaderPage({ params }: ChapterReaderProps) {
  const router = useRouter()
  const chapterIndex = parseInt(params.chapterIndex, 10)

  const [content, setContent] = useState<LocalLearningContent | null>(null)
  const [chapter, setChapter] = useState<LocalLearningChapter | null>(null)
  const [chapters, setChapters] = useState<LocalLearningChapter[]>([])
  const [progress, setProgress] = useState<LocalLearningProgress | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAI, setShowAI] = useState(false)
  const [startTime] = useState(Date.now())
  const [generating, setGenerating] = useState(false)
  const [contentEmpty, setContentEmpty] = useState(false)
  const generatedRef = useRef(false)

  // Yjs for document
  const ydoc = useMemo(() => new Y.Doc(), [])

  useEffect(() => {
    loadChapter()
    return () => {
      // Track time spent when leaving
      const minutes = Math.floor((Date.now() - startTime) / 60000)
      if (minutes > 0) {
        learningStore.addTimeSpent(params.contentId, minutes)
      }
    }
  }, [params.contentId, chapterIndex])

  const loadChapter = async () => {
    setLoading(true)
    try {
      const [contentData, chaptersData, progressData] = await Promise.all([
        learningStore.getContent(params.contentId),
        learningStore.getChapters(params.contentId),
        learningStore.getProgress(params.contentId),
      ])

      if (!contentData || !chaptersData[chapterIndex]) {
        router.push('/learn')
        return
      }

      setContent(contentData)
      setChapters(chaptersData)
      setChapter(chaptersData[chapterIndex])
      setProgress(progressData || null)

      // Update current chapter in progress
      await learningStore.updateCurrentChapter(params.contentId, chapterIndex)
    } catch (error) {
      console.error('Failed to load chapter:', error)
    } finally {
      setLoading(false)
    }
  }

  // IndexedDB persistence for the chapter document
  useEffect(() => {
    if (!chapter) return

    const persistence = new IndexeddbPersistence(chapter.documentId, ydoc)
    persistence.on('synced', () => {
      console.log('[ChapterReader] Content loaded from IndexedDB')
      // Check if content is empty after sync
      setTimeout(() => {
        const text = ydoc.getText('default')?.toString() || ''
        const xmlFragment = ydoc.getXmlFragment('default')
        const hasContent = text.trim().length > 10 || xmlFragment.length > 0
        setContentEmpty(!hasContent)
      }, 500)
    })

    return () => {
      persistence.destroy()
    }
  }, [chapter?.documentId, ydoc])

  // TipTap Editor (simplified for reading)
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: '章节内容加载中...',
      }),
      Collaboration.configure({
        document: ydoc,
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      Callout,
      Collapsible,
    ],
    editorProps: {
      attributes: {
        class: 'prose prose-invert prose-sm sm:prose lg:prose-lg max-w-none focus:outline-none min-h-[60vh]',
      },
    },
  }, [ydoc])

  // Generate chapter content
  const generateContent = useCallback(async () => {
    if (!content || !chapter || !editor || generatedRef.current) return

    generatedRef.current = true
    setGenerating(true)

    try {
      const response = await fetch('/api/learn/generate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseTitle: content.title,
          chapterTitle: chapter.title,
          chapterSummary: chapter.summary,
          keyPoints: chapter.keyPoints,
          chapterIndex,
          totalChapters: content.totalChapters,
          difficulty: content.difficulty,
        }),
      })

      if (!response.ok) throw new Error('Failed to generate content')
      if (!response.body) throw new Error('No response body')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        accumulated += chunk

        // Update editor content progressively
        editor.commands.setContent(accumulated)
      }

      setContentEmpty(false)
      console.log('[ChapterReader] Content generated successfully')
    } catch (error) {
      console.error('[ChapterReader] Failed to generate content:', error)
      generatedRef.current = false // Allow retry
    } finally {
      setGenerating(false)
    }
  }, [content, chapter, chapterIndex, editor])

  const handlePrevChapter = useCallback(() => {
    if (chapterIndex > 0) {
      router.push(`/learn/${params.contentId}/${chapterIndex - 1}`)
    }
  }, [chapterIndex, params.contentId, router])

  const handleNextChapter = useCallback(() => {
    if (chapters.length > 0 && chapterIndex < chapters.length - 1) {
      router.push(`/learn/${params.contentId}/${chapterIndex + 1}`)
    }
  }, [chapterIndex, chapters.length, params.contentId, router])

  const handleMarkComplete = useCallback(async () => {
    await learningStore.markChapterCompleted(params.contentId, chapterIndex)
    setProgress(await learningStore.getProgress(params.contentId) || null)

    // Auto-navigate to next chapter
    if (chapterIndex < chapters.length - 1) {
      handleNextChapter()
    }
  }, [params.contentId, chapterIndex, chapters.length, handleNextChapter])

  const isCompleted = progress?.completedChapters.includes(chapterIndex) || false

  if (loading || !content || !chapter) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-zinc-600 border-t-violet-500 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <EditorProvider>
      <div className="min-h-screen bg-zinc-950 flex">
        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <header className="border-b border-zinc-800 bg-zinc-900/50 sticky top-0 z-10">
            <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => router.push(`/learn/${params.contentId}`)}
                  className="flex items-center gap-2 text-zinc-400 hover:text-zinc-200 transition"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">返回目录</span>
                </button>

                <div className="h-4 w-px bg-zinc-700" />

                <div className="flex items-center gap-2 text-sm">
                  <BookOpen className="w-4 h-4 text-violet-500" />
                  <span className="text-zinc-500 hidden sm:inline">{content.title}</span>
                  <span className="text-zinc-600">·</span>
                  <span className="text-zinc-300">第 {chapterIndex + 1} 章</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowAI(!showAI)}
                  className={`
                    flex items-center gap-2 px-3 py-1.5 rounded-lg transition
                    ${showAI
                      ? 'bg-violet-500/20 text-violet-400'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                    }
                  `}
                >
                  <Lightbulb className="w-4 h-4" />
                  <span className="hidden sm:inline">AI 导师</span>
                </button>
              </div>
            </div>
          </header>

          {/* Chapter Content */}
          <main className="flex-1 overflow-auto">
            <div className="max-w-3xl mx-auto px-6 py-8">
              {/* Chapter Title */}
              <div className="mb-8">
                <div className="flex items-center gap-2 text-sm text-zinc-500 mb-2">
                  <span>第 {chapterIndex + 1} 章</span>
                  {isCompleted && (
                    <span className="flex items-center gap-1 text-emerald-500">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      已完成
                    </span>
                  )}
                </div>
                <h1 className="text-2xl font-bold text-zinc-100">{chapter.title}</h1>
                {chapter.summary && (
                  <p className="text-zinc-500 mt-2">{chapter.summary}</p>
                )}
              </div>

              {/* Key Points */}
              {chapter.keyPoints.length > 0 && (
                <div className="mb-8 p-4 bg-violet-500/5 border border-violet-500/20 rounded-xl">
                  <h3 className="text-sm font-medium text-violet-400 mb-2">本章要点</h3>
                  <ul className="space-y-1">
                    {chapter.keyPoints.map((point, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-zinc-400">
                        <span className="text-violet-500 mt-1">•</span>
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Editor Content */}
              <div className="prose-container">
                {generating ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-12 h-12 mb-4 relative">
                      <Sparkles className="w-12 h-12 text-violet-500 animate-pulse" />
                    </div>
                    <h3 className="text-lg font-medium text-zinc-200 mb-2">AI 正在生成课程内容...</h3>
                    <p className="text-sm text-zinc-500">根据章节大纲，为你量身定制学习材料</p>
                    <div className="mt-6 w-48 h-1 bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full bg-violet-500 rounded-full animate-[loading_2s_ease-in-out_infinite]" style={{ width: '60%' }} />
                    </div>
                  </div>
                ) : contentEmpty && !generating ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-16 h-16 bg-violet-500/10 rounded-2xl flex items-center justify-center mb-4">
                      <Sparkles className="w-8 h-8 text-violet-500" />
                    </div>
                    <h3 className="text-lg font-medium text-zinc-200 mb-2">章节内容待生成</h3>
                    <p className="text-sm text-zinc-500 max-w-md mb-6">
                      AI 将根据章节大纲和要点，为你生成详细的学习内容
                    </p>
                    <button
                      onClick={generateContent}
                      className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition"
                    >
                      <Sparkles className="w-4 h-4" />
                      生成学习内容
                    </button>
                  </div>
                ) : editor ? (
                  <EditorContent editor={editor} />
                ) : (
                  <div className="animate-pulse space-y-4">
                    <div className="h-4 bg-zinc-800 rounded w-full" />
                    <div className="h-4 bg-zinc-800 rounded w-4/5" />
                    <div className="h-4 bg-zinc-800 rounded w-3/4" />
                  </div>
                )}
              </div>
            </div>
          </main>

          {/* Footer Navigation */}
          <footer className="border-t border-zinc-800 bg-zinc-900/50 sticky bottom-0">
            <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
              <button
                onClick={handlePrevChapter}
                disabled={chapterIndex === 0}
                className="flex items-center gap-2 px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <ArrowLeft className="w-4 h-4" />
                上一章
              </button>

              <button
                onClick={handleMarkComplete}
                disabled={isCompleted}
                className={`
                  flex items-center gap-2 px-5 py-2 text-sm font-medium rounded-lg transition
                  ${isCompleted
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-violet-600 hover:bg-violet-500 text-white'
                  }
                `}
              >
                <CheckCircle2 className="w-4 h-4" />
                {isCompleted ? '已完成' : '标记完成'}
              </button>

              <button
                onClick={handleNextChapter}
                disabled={chapterIndex >= chapters.length - 1}
                className="flex items-center gap-2 px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                下一章
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </footer>
        </div>

        {/* AI Tutor Sidebar */}
        {showAI && (
          <aside className="w-96 border-l border-zinc-800 flex flex-col bg-zinc-900 flex-shrink-0">
            <div className="h-14 border-b border-zinc-800 flex items-center justify-between px-4 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-violet-500" />
                <h2 className="font-semibold text-zinc-200">AI 导师</h2>
              </div>
              <button
                onClick={() => setShowAI(false)}
                className="p-1 hover:bg-zinc-800 rounded transition"
              >
                <X className="w-4 h-4 text-zinc-500" />
              </button>
            </div>

            {/* Quick Questions */}
            <div className="px-4 py-3 border-b border-zinc-800/50">
              <div className="text-xs text-zinc-500 mb-2">快速提问</div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  '解释这个概念',
                  '举个例子',
                  '这有什么用？',
                  '总结要点',
                ].map((q) => (
                  <button
                    key={q}
                    className="px-2.5 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 rounded-full transition"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            <ChatSidebar />
          </aside>
        )}
      </div>
    </EditorProvider>
  )
}
