'use client'

import { Editor } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import { useInlineAI, AI_ACTIONS, AIAction } from '@/hooks/useInlineAI'
import { useState, useEffect, useCallback } from 'react'
import { Sparkles, Loader2, X, Check, RotateCcw, Brain, BookmarkPlus } from 'lucide-react'
import { CreateFlashcardDialog } from '@/components/srs/CreateFlashcardDialog'
import { useNoteExtractionOptional } from '@/contexts/NoteExtractionContext'
import { GhostFlight } from './GhostFlight'
import { AnimatePresence } from 'framer-motion'

interface AIBubbleMenuProps {
  editor: Editor
  documentId?: string
  chapterId?: string
}

interface FlyingNote {
  id: string
  content: string
  startRect: DOMRect
}

export function AIBubbleMenu({ editor, documentId, chapterId }: AIBubbleMenuProps) {
  const [showAI, setShowAI] = useState(false)
  const [showResult, setShowResult] = useState(false)
  const [showFlashcardDialog, setShowFlashcardDialog] = useState(false)
  const [flashcardSelection, setFlashcardSelection] = useState('')
  const [flyingNotes, setFlyingNotes] = useState<FlyingNote[]>([])
  const { completion, isLoading, runAction, stop, reset } = useInlineAI()

  // Note extraction context (optional - may not be available)
  const noteExtraction = useNoteExtractionOptional()

  // 获取选中的文本
  const getSelectedText = useCallback(() => {
    const { from, to } = editor.state.selection
    return editor.state.doc.textBetween(from, to, ' ')
  }, [editor])

  // 执行 AI 操作
  const handleAction = async (action: AIAction) => {
    const selection = getSelectedText()
    if (!selection) return

    setShowAI(false)
    setShowResult(true)
    reset()
    await runAction(action, selection)
  }

  // 应用结果
  const applyResult = useCallback(() => {
    if (!completion) return

    editor.chain().focus().deleteSelection().insertContent(completion).run()
    setShowResult(false)
    reset()
  }, [editor, completion, reset])

  // 取消
  const cancel = useCallback(() => {
    stop()
    setShowResult(false)
    reset()
  }, [stop, reset])

  // 提取笔记到知识库
  const handleExtractNote = useCallback(() => {
    if (!noteExtraction) {
      console.warn('[AIBubbleMenu] NoteExtraction context not available')
      return
    }

    const { from, to } = editor.state.selection
    if (from === to) return

    const content = editor.state.doc.textBetween(from, to, ' ')
    if (content.length < 10) {
      console.warn('[AIBubbleMenu] Selection too short to extract')
      return
    }

    // Get the selection rect for animation
    const selection = window.getSelection()
    const range = selection?.getRangeAt(0)
    const rect = range?.getBoundingClientRect()

    if (!rect) return

    // Create flying note for animation
    const tempId = crypto.randomUUID()
    setFlyingNotes(prev => [...prev, { id: tempId, content, startRect: rect }])

    // Determine source type
    const sourceType = chapterId ? 'learning' : 'document'

    // Trigger extraction
    noteExtraction.extractNote(content, rect, {
      sourceType,
      documentId,
      chapterId,
      position: { from, to },
    })
  }, [editor, noteExtraction, documentId, chapterId])

  // Clear flying note after animation
  const handleFlightComplete = useCallback((noteId: string) => {
    setFlyingNotes(prev => prev.filter(n => n.id !== noteId))
  }, [])

  // ESC 关闭
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowAI(false)
        setShowResult(false)
        reset()
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [reset])

  return (
    <>
      {/* 基础气泡菜单 */}
      <BubbleMenu
        editor={editor}
        shouldShow={({ state }) => {
          // 有选中文本且不在显示结果时才显示
          const { from, to } = state.selection
          return from !== to && !showResult
        }}
      >
        <div className="flex items-center gap-1 bg-background border rounded-lg shadow-lg p-1">
          {/* 常规格式化按钮 */}
          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`p-2 rounded hover:bg-muted ${editor.isActive('bold') ? 'bg-muted' : ''}`}
          >
            <span className="font-bold text-sm">B</span>
          </button>
          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`p-2 rounded hover:bg-muted ${editor.isActive('italic') ? 'bg-muted' : ''}`}
          >
            <span className="italic text-sm">I</span>
          </button>
          <button
            onClick={() => editor.chain().focus().toggleCode().run()}
            className={`p-2 rounded hover:bg-muted ${editor.isActive('code') ? 'bg-muted' : ''}`}
          >
            <span className="font-mono text-sm">{`</>`}</span>
          </button>

          <div className="w-px h-6 bg-border mx-1" />

          {/* AI 按钮 */}
          <button
            onClick={() => setShowAI(!showAI)}
            className="p-2 rounded hover:bg-muted flex items-center gap-1 text-sm"
          >
            <Sparkles className="w-4 h-4" />
            <span>AI</span>
          </button>

          <div className="w-px h-6 bg-border mx-1" />

          {/* 创建卡片按钮 */}
          <button
            onClick={() => {
              const text = getSelectedText()
              if (text) {
                setFlashcardSelection(text)
                setShowFlashcardDialog(true)
              }
            }}
            className="p-2 rounded hover:bg-muted flex items-center gap-1 text-sm"
            title="创建闪卡"
          >
            <Brain className="w-4 h-4" />
          </button>

          {/* 提取到知识库按钮 */}
          {noteExtraction && (
            <>
              <div className="w-px h-6 bg-border mx-1" />
              <button
                onClick={handleExtractNote}
                className="p-2 rounded hover:bg-muted flex items-center gap-1 text-sm text-primary"
                title="提取到知识库"
              >
                <BookmarkPlus className="w-4 h-4" />
              </button>
            </>
          )}
        </div>

        {/* AI 操作菜单 */}
        {showAI && (
          <div className="absolute top-full left-0 mt-1 bg-background border rounded-lg shadow-lg p-1 min-w-[180px] z-50">
            {(Object.entries(AI_ACTIONS) as [AIAction, { label: string; icon: string }][]).map(
              ([action, { label, icon }]) => (
                <button
                  key={action}
                  onClick={() => handleAction(action)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-muted rounded flex items-center gap-2"
                >
                  <span>{icon}</span>
                  <span>{label}</span>
                </button>
              )
            )}
          </div>
        )}
      </BubbleMenu>

      {/* AI 结果浮层 */}
      {showResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
          <div className="bg-background border rounded-lg shadow-xl w-full max-w-lg mx-4">
            <div className="p-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                <span className="font-medium">AI Result</span>
              </div>
              <button onClick={cancel} className="p-1 hover:bg-muted rounded">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 min-h-[100px] max-h-[300px] overflow-auto">
              {isLoading && !completion ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Generating...</span>
                </div>
              ) : (
                <p className="text-sm whitespace-pre-wrap">{completion}</p>
              )}
            </div>

            <div className="p-4 border-t flex items-center justify-end gap-2">
              {isLoading ? (
                <button
                  onClick={stop}
                  className="px-3 py-1.5 text-sm border rounded hover:bg-muted"
                >
                  Stop
                </button>
              ) : (
                <>
                  <button
                    onClick={cancel}
                    className="px-3 py-1.5 text-sm border rounded hover:bg-muted flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Discard
                  </button>
                  <button
                    onClick={applyResult}
                    disabled={!completion}
                    className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded hover:opacity-90 disabled:opacity-50 flex items-center gap-1"
                  >
                    <Check className="w-3 h-3" />
                    Replace
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 创建闪卡对话框 */}
      <CreateFlashcardDialog
        isOpen={showFlashcardDialog}
        onClose={() => setShowFlashcardDialog(false)}
        initialFront={flashcardSelection}
      />

      {/* 幽灵飞梭动画 */}
      <AnimatePresence>
        {flyingNotes.map(note => (
          <GhostFlight
            key={note.id}
            id={note.id}
            content={note.content}
            startRect={note.startRect}
            onComplete={() => handleFlightComplete(note.id)}
          />
        ))}
      </AnimatePresence>
    </>
  )
}
