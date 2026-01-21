'use client'

import { useChat } from '@ai-sdk/react'
import { useRef, useEffect, useState, FormEvent } from 'react'
import { Send, Square, User, Bot, BookOpen } from 'lucide-react'

export function ChatSidebar() {
  const [enableRAG, setEnableRAG] = useState(true)
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { messages, status, stop, error, sendMessage } = useChat({
    id: 'chat-sidebar',
  })

  const isLoading = status === 'streaming' || status === 'submitted'

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const text = input.trim()
    setInput('')

    await sendMessage({ text }, { body: { enableRAG } })
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* RAG 开关 */}
      <div className="px-4 py-2 border-b flex items-center justify-between bg-muted/30">
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

      {/* Messages */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            <Bot className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Ask me anything about your notes</p>
            <p className="text-sm mt-2">
              {enableRAG
                ? 'I\'ll search your knowledge base for relevant context.'
                : 'RAG is disabled. Enable it to search your notes.'}
            </p>
          </div>
        )}

        {messages.map((message) => {
          const text = message.parts
            .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
            .map(p => p.text)
            .join('')

          return (
            <div
              key={message.id}
              className={`flex gap-3 ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {message.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-primary-foreground" />
                </div>
              )}

              <div
                className={`max-w-[80%] rounded-lg px-4 py-2 ${
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{text}</p>
              </div>

              {message.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          )
        })}

        {isLoading && (
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
      <form onSubmit={handleSubmit} className="p-4 border-t">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={enableRAG ? 'Search your knowledge base...' : 'Ask AI...'}
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

        {enableRAG && (
          <p className="text-xs text-muted-foreground mt-2">
            RAG enabled - AI will search your notes for context
          </p>
        )}
      </form>
    </div>
  )
}
