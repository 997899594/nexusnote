'use client'

import { useChat } from '@ai-sdk/react'
import { useRef, useEffect, useState, FormEvent } from 'react'
import { Send, Square, User, Bot, BookOpen, FileText, Pencil, Copy, FileDown, Sparkles, MessageSquare, Lightbulb, Ghost } from 'lucide-react'
import { smartConvert, sanitizeHtml } from '@/lib/markdown'
import { useEditorContext } from '@/contexts/EditorContext'
import { EditPreviewPanel, parseEditResponse } from './EditPreviewPanel'
import { AgentChat } from './AgentChat'
import { KnowledgePanel } from './KnowledgePanel'
import { useNoteExtractionOptional } from '@/contexts/NoteExtractionContext'
import type { EditCommand, DocumentBlock } from '@/lib/document-parser'
import { motion, AnimatePresence } from 'framer-motion'
// Generative UI Components
import { FlashcardCreated, SearchResults, ReviewStats, LearningPlan } from './ui'

type SidebarMode = 'chat' | 'agent' | 'knowledge'

interface PendingEditItem {
  command: EditCommand
  originalContent: string
}

interface PendingEdits {
  items: PendingEditItem[]
  messageId: string
}

function renderToolInvocation(toolName: string, result: any) {
  if (!result) return null
  switch (toolName) {
    case 'createFlashcards': return result.success && result.cards && <FlashcardCreated count={result.count} cards={result.cards} />
    case 'searchNotes': return <SearchResults query={result.query || ''} results={result.results || []} />
    case 'getReviewStats': return <ReviewStats {...result} />
    case 'createLearningPlan': return <LearningPlan {...result} />
  }
  return null
}

export function ChatSidebar() {
  const [mode, setMode] = useState<SidebarMode>('chat')
  const [enableRAG, setEnableRAG] = useState(false)
  const [useDocContext, setUseDocContext] = useState(true)
  const [editMode, setEditMode] = useState(true)
  const [input, setInput] = useState('')
  const [pendingEdits, setPendingEdits] = useState<PendingEdits | null>(null)
  const [currentEditIndex, setCurrentEditIndex] = useState(0)
  const [processedMessageIds, setProcessedMessageIds] = useState<Set<string>>(new Set())
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const editorContext = useEditorContext()

  const { messages, status, stop, sendMessage } = useChat({ id: 'chat-sidebar' })
  const noteExtraction = useNoteExtractionOptional()
  const isLoading = status === 'streaming' || status === 'submitted'

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (isLoading || !editMode || !editorContext) return
    const lastAssistantMessage = messages.filter(m => m.role === 'assistant').pop()
    if (!lastAssistantMessage || processedMessageIds.has(lastAssistantMessage.id)) return

    const text = lastAssistantMessage.parts
      .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
      .map(p => p.text).join('')

    const { editCommands } = parseEditResponse(text)
    if (editCommands.length > 0 && !pendingEdits) {
      const structure = editorContext.getDocumentStructure()
      const items: PendingEditItem[] = []
      for (const cmd of editCommands) {
        if (cmd.action === 'replace_all') {
          items.push({ command: cmd, originalContent: editorContext.getDocumentContent() })
        } else {
          const targetBlock = structure?.blocks.find((b: DocumentBlock) => b.id === cmd.targetId)
          if (targetBlock) items.push({ command: cmd, originalContent: targetBlock.content })
        }
      }
      if (items.length > 0) {
        setPendingEdits({ items, messageId: lastAssistantMessage.id })
        setCurrentEditIndex(0)
      }
    }
  }, [messages, isLoading, editMode, editorContext, pendingEdits, processedMessageIds])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return
    const text = input.trim()
    setInput('')
    setPendingEdits(null)
    setCurrentEditIndex(0)
    const documentContext = useDocContext ? editorContext?.getDocumentContent() : undefined
    const documentStructure = editMode && useDocContext ? editorContext?.getDocumentSummary() : undefined
    await sendMessage({ text }, { body: { enableRAG, documentContext, documentStructure, editMode: editMode && useDocContext } })
  }

  const handleApplyAllEdits = () => {
    if (!pendingEdits || !editorContext) return
    editorContext.applyEdits(pendingEdits.items.map(i => i.command))
    setProcessedMessageIds(prev => new Set(prev).add(pendingEdits.messageId))
    setPendingEdits(null)
  }

  const insertToEditor = (text: string) => {
    if (!editorContext?.editor) return
    const { html } = smartConvert(text)
    editorContext.editor.chain().focus().insertContent(sanitizeHtml(html)).run()
  }

  const copyToClipboard = async (text: string) => {
    try { await navigator.clipboard.writeText(text) } catch (err) { }
  }

  const documentContextAgent = editorContext ? {
    id: 'current',
    title: '当前文档',
    content: editorContext.getDocumentContent() || '',
  } : undefined

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-transparent">
      {/* Mode Tabs */}
      <div className="flex px-4 gap-1 flex-shrink-0 mb-2">
        {(['chat', 'agent', 'knowledge'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-xs font-bold tracking-tight transition-all duration-300 ${mode === m
                ? 'bg-violet-500/10 text-violet-500 shadow-[inset_0_0_12px_rgba(139,92,246,0.1)]'
                : 'text-muted-foreground hover:bg-muted/50'
              }`}
          >
            {m === 'chat' && <MessageSquare className="w-3.5 h-3.5" />}
            {m === 'agent' && <Sparkles className="w-3.5 h-3.5" />}
            {m === 'knowledge' && <Lightbulb className="w-3.5 h-3.5" />}
            {m === 'chat' ? '对话' : m === 'agent' ? '智能体' : '知识库'}
          </button>
        ))}
      </div>

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {mode === 'agent' && (
          <AgentChat agentType="knowledge" documentContext={documentContextAgent} />
        )}
        {mode === 'knowledge' && <KnowledgePanel />}
        {mode === 'chat' && (
          <>
            {/* Context Control Glass Tile */}
            <div className="mx-4 mb-4 p-3 rounded-3xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 space-y-2">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
                  <FileText className="w-3 h-3" />
                  <span>启用当前文档</span>
                </div>
                <Switch active={useDocContext} onClick={() => setUseDocContext(!useDocContext)} />
              </div>
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
                  <Pencil className="w-3 h-3" />
                  <span>启用协作修改</span>
                </div>
                <Switch active={editMode && useDocContext} disabled={!useDocContext} onClick={() => setEditMode(!editMode)} />
              </div>
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
                  <BookOpen className="w-3 h-3" />
                  <span>关联全局知识 (RAG)</span>
                </div>
                <Switch active={enableRAG} onClick={() => setEnableRAG(!enableRAG)} />
              </div>
            </div>

            {/* Chat Stream */}
            <div className="flex-1 overflow-y-auto px-4 space-y-6 custom-scrollbar pb-4 min-h-0">
              {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center px-8 opacity-40">
                  <div className="w-16 h-16 rounded-[2rem] bg-violet-500/10 flex items-center justify-center mb-6">
                    <Ghost className="w-8 h-8 text-violet-500 animate-pulse" />
                  </div>
                  <p className="text-sm font-medium">随时提问，我会根据您的笔记提供答案</p>
                  <p className="text-xs mt-2">试试：“帮我总结当前的重点”</p>
                </div>
              )}

              {messages.map((message) => (
                <div key={message.id} className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`flex gap-3 max-w-[92%] ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-8 h-8 rounded-2xl flex items-center justify-center shrink-0 ${message.role === 'assistant' ? 'bg-violet-500/20 text-violet-500' : 'bg-muted text-muted-foreground'}`}>
                      {message.role === 'assistant' ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                    </div>
                    <div className={`rounded-[1.5rem] px-4 py-3 text-sm leading-relaxed shadow-sm ${message.role === 'user'
                        ? 'bg-violet-600 text-white rounded-tr-sm'
                        : 'bg-white dark:bg-neutral-800 border border-black/5 dark:border-white/5 rounded-tl-sm'
                      }`}>
                      {message.role === 'assistant' ? (
                        <div>
                          <p className="whitespace-pre-wrap">{formatMessageText(message.parts.filter(p => p.type === 'text').map((p: any) => p.text).join(''))}</p>
                          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-black/5 dark:border-white/5 opacity-50 hover:opacity-100 transition-opacity">
                            <button onClick={() => insertToEditor(message.content)} className="flex items-center gap-1 hover:text-violet-500"><FileDown className="w-3 h-3" /> 插入</button>
                            <button onClick={() => copyToClipboard(message.content)} className="flex items-center gap-1 hover:text-violet-500"><Copy className="w-3 h-3" /> 复制</button>
                          </div>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap">{message.content}</p>
                      )}
                    </div>
                  </div>

                  {/* Edit Preview Logic Integration (Simplified for Redesign) */}
                  {pendingEdits?.messageId === message.id && (
                    <div className="mt-3 w-[92%] pl-11">
                      <div className="bg-violet-500/5 border border-violet-500/10 rounded-2xl p-4">
                        <p className="text-[10px] font-black uppercase text-violet-500 mb-2">待处理的编辑建议</p>
                        <button onClick={handleApplyAllEdits} className="w-full py-2 bg-violet-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-violet-900/20 hover:scale-[1.02] active:scale-95 transition-all">立即全量应用</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Sticky Input Bar */}
            <div className="p-4 border-t border-black/5 dark:border-white/5 backdrop-blur-3xl shrink-0">
              <form onSubmit={handleSubmit} className="relative group">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="输入指令..."
                  disabled={isLoading}
                  className="w-full bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-[1.5rem] pl-5 pr-12 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 transition-all placeholder:text-muted-foreground/50"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  {isLoading ? (
                    <button type="button" onClick={stop} className="w-9 h-9 flex items-center justify-center bg-red-500/10 text-red-500 rounded-full hover:bg-red-500 hover:text-white transition-all"><Square className="w-4 h-4 fill-current" /></button>
                  ) : (
                    <button type="submit" disabled={!input.trim()} className="w-9 h-9 flex items-center justify-center bg-violet-600 text-white rounded-full disabled:opacity-30 disabled:grayscale transition-all shadow-lg shadow-violet-950/20 hover:scale-105 active:scale-95"><Send className="w-4 h-4" /></button>
                  )}
                </div>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Switch({ active, onClick, disabled }: any) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-9 h-5 rounded-full transition-all duration-500 p-0.5 relative flex items-center ${active ? 'bg-violet-600' : 'bg-black/10 dark:bg-white/10'} ${disabled ? 'opacity-30 grayscale cursor-not-allowed' : ''}`}
    >
      <motion.div animate={{ x: active ? 16 : 0 }} className="w-4 h-4 rounded-full bg-white shadow-sm" />
    </button>
  )
}

function formatMessageText(text: string): string {
  let cleaned = text.replace(/<<<EDIT_START>>>[\s\S]*?<<<EDIT_END>>>/g, '').replace(/<<<EDIT_START>>>[\s\S]*/g, '').replace(/^解释[：:]\s*/gm, '').trim()
  return cleaned || '正在生成解析内容...'
}
