'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, Sparkles, Loader2, Brain } from 'lucide-react'
import { flashcardStore } from '@/lib/storage/flashcard-store'

interface CreateFlashcardDialogProps {
  isOpen: boolean
  onClose: () => void
  initialFront?: string
  context?: string
  documentId?: string
}

export function CreateFlashcardDialog({
  isOpen,
  onClose,
  initialFront = '',
  context,
  documentId,
}: CreateFlashcardDialogProps) {
  const [front, setFront] = useState(initialFront)
  const [back, setBack] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setFront(initialFront)
      setBack('')
    }
  }, [isOpen, initialFront])

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [isOpen, onClose])

  const generateAnswer = useCallback(async () => {
    if (!front.trim()) return

    setIsGenerating(true)
    try {
      const response = await fetch('/api/flashcard/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: front,
          context,
        }),
      })

      if (!response.ok) throw new Error('Failed to generate')

      const data = await response.json()
      setBack(data.answer || '')
    } catch (error) {
      console.error('Failed to generate answer:', error)
    } finally {
      setIsGenerating(false)
    }
  }, [front, context])

  const handleSave = useCallback(async () => {
    if (!front.trim() || !back.trim()) return

    setIsSaving(true)
    try {
      await flashcardStore.createCard(front.trim(), back.trim(), {
        documentId,
        context,
      })
      onClose()
    } catch (error) {
      console.error('Failed to create flashcard:', error)
    } finally {
      setIsSaving(false)
    }
  }, [front, back, documentId, context, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white border rounded-2xl w-full max-w-lg mx-4 shadow-xl">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-violet-500" />
            <span className="font-medium text-gray-900">创建卡片</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Front (Question) */}
          <div>
            <label className="block text-sm text-gray-600 mb-2">问题 (正面)</label>
            <textarea
              value={front}
              onChange={(e) => setFront(e.target.value)}
              placeholder="输入问题..."
              className="w-full h-24 bg-gray-50 border rounded-xl px-4 py-3 text-gray-800 placeholder:text-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition"
            />
          </div>

          {/* Back (Answer) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-gray-600">答案 (背面)</label>
              <button
                onClick={generateAnswer}
                disabled={isGenerating || !front.trim()}
                className="flex items-center gap-1.5 px-3 py-1 text-xs bg-violet-100 text-violet-700 hover:bg-violet-200 rounded-lg transition disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3 h-3" />
                    AI 生成
                  </>
                )}
              </button>
            </div>
            <textarea
              value={back}
              onChange={(e) => setBack(e.target.value)}
              placeholder="输入答案或点击 AI 生成..."
              className="w-full h-24 bg-gray-50 border rounded-xl px-4 py-3 text-gray-800 placeholder:text-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition"
            />
          </div>

          {/* Context Preview */}
          {context && (
            <div className="p-3 bg-gray-50 border rounded-lg">
              <span className="text-xs text-gray-500 block mb-1">上下文</span>
              <p className="text-sm text-gray-600 line-clamp-2">{context}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 transition"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !front.trim() || !back.trim()}
            className="flex items-center gap-2 px-5 py-2 bg-violet-600 hover:bg-violet-500 disabled:bg-violet-300 text-white rounded-lg transition"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                保存中...
              </>
            ) : (
              '创建卡片'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
