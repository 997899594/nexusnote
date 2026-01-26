'use client'

import { useChat } from '@ai-sdk/react'
import { useRef, useEffect, useState, FormEvent } from 'react'
import { Send, Square, User, Bot, BookOpen, FileText, Pencil, Copy, FileDown, Sparkles, MessageSquare, Lightbulb } from 'lucide-react'
import { smartConvert, sanitizeHtml } from '@/lib/markdown'
import { useEditorContext } from '@/contexts/EditorContext'
import { EditPreviewPanel, parseEditResponse } from './EditPreviewPanel'
import { AgentChat } from './AgentChat'
import { KnowledgePanel } from './KnowledgePanel'
import { useNoteExtractionOptional } from '@/contexts/NoteExtractionContext'
import type { EditCommand, DocumentBlock } from '@/lib/document-parser'
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

// 渲染工具调用结果的 Generative UI
function renderToolInvocation(toolName: string, result: any) {
  if (!result) return null

  switch (toolName) {
    case 'createFlashcards':
      if (result.success && result.cards) {
        return <FlashcardCreated count={result.count} cards={result.cards} />
      }
      break

    case 'searchNotes':
      return <SearchResults query={result.query || ''} results={result.results || []} />

    case 'getReviewStats':
      return (
        <ReviewStats
          totalCards={result.totalCards || 0}
          dueToday={result.dueToday || 0}
          newCards={result.newCards || 0}
          learningCards={result.learningCards || 0}
          masteredCards={result.masteredCards || 0}
          retention={result.retention || 0}
          streak={result.streak || 0}
        />
      )

    case 'createLearningPlan':
      return (
        <LearningPlan
          topic={result.topic || ''}
          duration={result.duration || ''}
          level={result.level || 'beginner'}
          phases={result.phases}
        />
      )
  }

  return null
}

export function ChatSidebar() {
  const [mode, setMode] = useState<SidebarMode>('chat')
  const [enableRAG, setEnableRAG] = useState(false)
  const [useDocContext, setUseDocContext] = useState(true)
  const [editMode, setEditMode] = useState(true) // 默认开启编辑模式
  const [input, setInput] = useState('')
  const [pendingEdits, setPendingEdits] = useState<PendingEdits | null>(null)
  const [currentEditIndex, setCurrentEditIndex] = useState(0) // 当前预览的编辑索引
  const [processedMessageIds, setProcessedMessageIds] = useState<Set<string>>(new Set())
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const editorContext = useEditorContext()

  const { messages, status, stop, error, sendMessage } = useChat({
    id: 'chat-sidebar',
  })

  // Note extraction context for Knowledge tab ref
  const noteExtraction = useNoteExtractionOptional()

  const isLoading = status === 'streaming' || status === 'submitted'

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 检测最新的 AI 消息是否包含编辑命令（支持批量）
  useEffect(() => {
    if (isLoading || !editMode || !editorContext) return

    const lastAssistantMessage = messages.filter(m => m.role === 'assistant').pop()
    if (!lastAssistantMessage) return

    // 跳过已处理过的消息
    if (processedMessageIds.has(lastAssistantMessage.id)) return

    const text = lastAssistantMessage.parts
      .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
      .map(p => p.text)
      .join('')

    const { editCommands } = parseEditResponse(text)

    if (editCommands.length > 0 && !pendingEdits) {
      const structure = editorContext.getDocumentStructure()
      const items: PendingEditItem[] = []

      for (const cmd of editCommands) {
        // replace_all 特殊处理：用整个文档内容作为原始内容
        if (cmd.action === 'replace_all') {
          items.push({
            command: cmd,
            originalContent: editorContext.getDocumentContent(),
          })
        } else {
          const targetBlock = structure?.blocks.find((b: DocumentBlock) => b.id === cmd.targetId)
          if (targetBlock) {
            items.push({
              command: cmd,
              originalContent: targetBlock.content,
            })
          }
        }
      }

      if (items.length > 0) {
        setPendingEdits({
          items,
          messageId: lastAssistantMessage.id,
        })
        setCurrentEditIndex(0)
      }
    }
  }, [messages, isLoading, editMode, editorContext, pendingEdits, processedMessageIds])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const text = input.trim()
    setInput('')
    setPendingEdits(null) // 清除之前的待处理编辑
    setCurrentEditIndex(0)

    // 获取当前文档内容
    const documentContext = useDocContext ? editorContext?.getDocumentContent() : undefined

    // 获取文档结构（编辑模式需要）
    const documentStructure = editMode && useDocContext
      ? editorContext?.getDocumentSummary()
      : undefined

    await sendMessage({ text }, {
      body: {
        enableRAG,
        documentContext,
        documentStructure,
        editMode: editMode && useDocContext,
      }
    })
  }

  // 应用所有编辑（批量）
  const handleApplyAllEdits = () => {
    if (!pendingEdits || !editorContext) return

    const commands = pendingEdits.items.map(item => item.command)
    const result = editorContext.applyEdits(commands)

    console.log(`[ChatSidebar] Applied ${result.success}/${commands.length} edits`)
    if (result.failed > 0) {
      console.warn(`[ChatSidebar] ${result.failed} edits failed`)
    }

    // 标记消息已处理
    setProcessedMessageIds(prev => new Set(prev).add(pendingEdits.messageId))
    setPendingEdits(null)
    setCurrentEditIndex(0)
  }

  // 应用当前单个编辑
  const handleApplySingleEdit = () => {
    if (!pendingEdits || !editorContext) return

    const currentItem = pendingEdits.items[currentEditIndex]
    if (!currentItem) return

    const success = editorContext.applyEdit(currentItem.command)
    if (success) {
      console.log(`[ChatSidebar] Edit ${currentEditIndex + 1} applied`)
    }

    // 移动到下一个编辑，或完成
    if (currentEditIndex < pendingEdits.items.length - 1) {
      setCurrentEditIndex(currentEditIndex + 1)
    } else {
      // 所有编辑完成
      setProcessedMessageIds(prev => new Set(prev).add(pendingEdits.messageId))
      setPendingEdits(null)
      setCurrentEditIndex(0)
    }
  }

  // 跳过当前编辑
  const handleSkipEdit = () => {
    if (!pendingEdits) return

    if (currentEditIndex < pendingEdits.items.length - 1) {
      setCurrentEditIndex(currentEditIndex + 1)
    } else {
      // 跳过最后一个，全部完成
      setProcessedMessageIds(prev => new Set(prev).add(pendingEdits.messageId))
      setPendingEdits(null)
      setCurrentEditIndex(0)
    }
  }

  // 放弃所有编辑
  const handleDiscardAllEdits = () => {
    if (!pendingEdits) return
    setProcessedMessageIds(prev => new Set(prev).add(pendingEdits.messageId))
    setPendingEdits(null)
    setCurrentEditIndex(0)
  }

  // 高亮当前目标块
  const handleHighlightBlock = () => {
    if (!pendingEdits || !editorContext) return
    const currentItem = pendingEdits.items[currentEditIndex]
    if (currentItem && currentItem.command.action !== 'replace_all') {
      editorContext.highlightBlock(currentItem.command.targetId)
    }
  }

  // 格式化消息显示（隐藏编辑标记）
  const formatMessageText = (text: string): string => {
    // 移除编辑命令块（包括正在流式输出的不完整块）
    let cleaned = text
    // 移除完整的编辑块
    cleaned = cleaned.replace(/<<<EDIT_START>>>[\s\S]*?<<<EDIT_END>>>/g, '')
    // 移除正在输出的不完整编辑块
    cleaned = cleaned.replace(/<<<EDIT_START>>>[\s\S]*/g, '')
    // 移除解释前缀
    cleaned = cleaned.replace(/^解释[：:]\s*/gm, '').trim()
    return cleaned || '正在生成编辑建议...'
  }

  // 将 AI 内容插入编辑器（带 Markdown 转换）
  const insertToEditor = (text: string) => {
    if (!editorContext?.editor) return

    // 转换 Markdown 为 HTML
    const { html } = smartConvert(text)
    const safeHtml = sanitizeHtml(html)

    // 在当前位置插入
    editorContext.editor.chain().focus().insertContent(safeHtml).run()
  }

  // 复制内容
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  // 获取当前文档上下文给 Agent
  const documentContext = editorContext ? {
    id: 'current',
    title: 'Current Document',
    content: editorContext.getDocumentContent() || '',
  } : undefined

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Mode Tabs */}
      <div className="flex border-b flex-shrink-0">
        <button
          onClick={() => setMode('chat')}
          className={`flex-1 px-4 py-2 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
            mode === 'chat'
              ? 'text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          Chat
        </button>
        <button
          onClick={() => setMode('agent')}
          className={`flex-1 px-4 py-2 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
            mode === 'agent'
              ? 'text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          Agent
        </button>
        <button
          ref={noteExtraction?.knowledgeTabRef}
          onClick={() => setMode('knowledge')}
          className={`flex-1 px-4 py-2 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
            mode === 'knowledge'
              ? 'text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Lightbulb className="w-4 h-4" />
          Knowledge
        </button>
      </div>

      {/* Agent Mode */}
      {mode === 'agent' && (
        <AgentChat
          agentType="knowledge"
          documentContext={documentContext}
          onResult={(output) => {
            console.log('[ChatSidebar] Agent result:', output)
          }}
        />
      )}

      {/* Knowledge Mode */}
      {mode === 'knowledge' && <KnowledgePanel />}

      {/* Chat Mode */}
      {mode === 'chat' && (
        <>
      {/* Context 开关区 */}
      <div className="px-4 py-2 border-b bg-muted/30 space-y-2 flex-shrink-0">
        {/* 当前文档上下文 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <FileText className="w-4 h-4" />
            <span>Current Document</span>
          </div>
          <button
            onClick={() => setUseDocContext(!useDocContext)}
            className={`relative w-10 h-5 rounded-full transition-colors ${
              useDocContext ? 'bg-primary' : 'bg-muted'
            }`}
          >
            <span
              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                useDocContext ? 'left-5' : 'left-0.5'
              }`}
            />
          </button>
        </div>

        {/* 编辑模式 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <Pencil className="w-4 h-4" />
            <span>Edit Mode</span>
          </div>
          <button
            onClick={() => setEditMode(!editMode)}
            disabled={!useDocContext}
            className={`relative w-10 h-5 rounded-full transition-colors ${
              editMode && useDocContext ? 'bg-primary' : 'bg-muted'
            } ${!useDocContext ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <span
              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                editMode && useDocContext ? 'left-5' : 'left-0.5'
              }`}
            />
          </button>
        </div>

        {/* 知识库 RAG */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <BookOpen className="w-4 h-4" />
            <span>Knowledge Base</span>
          </div>
          <button
            onClick={() => setEnableRAG(!enableRAG)}
            className={`relative w-10 h-5 rounded-full transition-colors ${
              enableRAG ? 'bg-primary' : 'bg-muted'
            }`}
          >
            <span
              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                enableRAG ? 'left-5' : 'left-0.5'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto p-4 space-y-4 min-h-0">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            <Bot className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Ask me anything about your notes</p>
            <p className="text-sm mt-2">
              {editMode && useDocContext
                ? 'Edit mode: Try "把第一段改成更正式的语气"'
                : useDocContext
                ? 'I can see your current document content.'
                : enableRAG
                ? 'I\'ll search your knowledge base for relevant context.'
                : 'Enable options above to use document context.'}
            </p>
          </div>
        )}

        {messages.map((message) => {
          const rawText = message.parts
            .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
            .map(p => p.text)
            .join('')

          // 提取工具调用结果 (AI SDK 4.x format)
          const toolParts = message.parts.filter(
            (p) => p.type?.startsWith('tool-')
          ) as Array<any>

          const displayText = message.role === 'assistant'
            ? formatMessageText(rawText)
            : rawText

          // 检查这条消息是否有待处理的编辑
          const hasPendingEdits = pendingEdits?.messageId === message.id
          const currentEditItem = hasPendingEdits ? pendingEdits.items[currentEditIndex] : null
          const totalEdits = hasPendingEdits ? pendingEdits.items.length : 0

          return (
            <div key={message.id}>
              <div
                className={`flex gap-3 ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {message.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-primary-foreground" />
                  </div>
                )}

                <div className="max-w-[85%] space-y-2">
                  {/* 文本消息 */}
                  {displayText && (
                    <div
                      className={`rounded-lg px-4 py-2 ${
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{displayText}</p>

                      {/* AI 消息操作按钮 */}
                      {message.role === 'assistant' && !hasPendingEdits && toolParts.length === 0 && (
                        <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border/50">
                          <button
                            onClick={() => insertToEditor(displayText)}
                            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 px-2 py-1 rounded hover:bg-background/50"
                            title="Insert to editor"
                          >
                            <FileDown className="w-3 h-3" />
                            插入
                          </button>
                          <button
                            onClick={() => copyToClipboard(displayText)}
                            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 px-2 py-1 rounded hover:bg-background/50"
                            title="Copy"
                          >
                            <Copy className="w-3 h-3" />
                            复制
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Generative UI - 工具调用结果 */}
                  {message.role === 'assistant' && toolParts.map((part, idx) => {
                    // AI SDK 4.x tool part format: { type: 'tool-createFlashcards', ... }
                    const toolName = part.type?.replace('tool-', '') || ''
                    const state = part.state
                    const result = part.output

                    // 工具正在调用中
                    if (state === 'call' || state === 'input-streaming') {
                      return (
                        <div key={idx} className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                          <Sparkles className="w-4 h-4 animate-pulse" />
                          <span>正在执行 {toolName}...</span>
                        </div>
                      )
                    }

                    // 工具调用完成，渲染 UI
                    if (state === 'result' || state === 'output-complete') {
                      const ui = renderToolInvocation(toolName, result)
                      if (ui) return <div key={idx}>{ui}</div>
                    }

                    return null
                  })}
                </div>

                {message.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>

              {/* 批量编辑预览面板 */}
              {hasPendingEdits && currentEditItem && (
                <div className="mt-3 ml-11">
                  {/* 批量编辑进度指示 */}
                  {totalEdits > 1 && (
                    <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                      <span>编辑 {currentEditIndex + 1} / {totalEdits}</span>
                      <div className="flex gap-2">
                        <button
                          onClick={handleApplyAllEdits}
                          className="px-2 py-1 bg-primary text-primary-foreground rounded hover:opacity-90"
                        >
                          全部应用
                        </button>
                        <button
                          onClick={handleDiscardAllEdits}
                          className="px-2 py-1 border rounded hover:bg-muted"
                        >
                          全部放弃
                        </button>
                      </div>
                    </div>
                  )}
                  <EditPreviewPanel
                    originalContent={currentEditItem.originalContent}
                    editCommand={currentEditItem.command}
                    onApply={totalEdits > 1 ? handleApplySingleEdit : handleApplyAllEdits}
                    onDiscard={totalEdits > 1 ? handleSkipEdit : handleDiscardAllEdits}
                    onHighlight={handleHighlightBlock}
                  />
                </div>
              )}
            </div>
          )
        })}

        {/* 只在提交请求等待响应时显示加载动画，流式输出时不显示（避免重复气泡） */}
        {status === 'submitted' && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-primary-foreground" />
            </div>
            <div className="bg-muted rounded-lg px-4 py-2">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-foreground/50 rounded-full animate-bounce" />
                <span className="w-2 h-2 bg-foreground/50 rounded-full animate-bounce [animation-delay:0.1s]" />
                <span className="w-2 h-2 bg-foreground/50 rounded-full animate-bounce [animation-delay:0.2s]" />
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="text-red-500 text-sm p-2 bg-red-50 rounded">
            Error: {error.message}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t flex-shrink-0">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              editMode && useDocContext
                ? 'Edit: "把第一段改成..."'
                : useDocContext
                ? 'Ask about this document...'
                : enableRAG
                ? 'Search your knowledge base...'
                : 'Ask AI...'
            }
            className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
            disabled={isLoading}
          />

          {isLoading ? (
            <button
              type="button"
              onClick={stop}
              className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
              title="Stop generating"
            >
              <Square className="w-5 h-5" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input?.trim()}
              className="p-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition disabled:opacity-50"
            >
              <Send className="w-5 h-5" />
            </button>
          )}
        </div>

        <p className="text-xs text-muted-foreground mt-2">
          {editMode && useDocContext
            ? 'Edit mode: AI can modify your document'
            : useDocContext && enableRAG
            ? 'Using current document + knowledge base'
            : useDocContext
            ? 'Using current document context'
            : enableRAG
            ? 'Searching knowledge base'
            : ''}
        </p>
      </form>
        </>
      )}
    </div>
  )
}
