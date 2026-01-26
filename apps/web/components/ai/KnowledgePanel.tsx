'use client'

import { useNoteExtractionOptional, Topic, ExtractedNote } from '@/contexts/NoteExtractionContext'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, BookOpen, ChevronRight, Sparkles } from 'lucide-react'
import { useState } from 'react'

/**
 * TopicCard - A single topic card with note count and preview
 */
function TopicCard({ topic, onClick }: { topic: Topic; onClick: () => void }) {
  return (
    <motion.div
      layout
      className="p-3 bg-card border rounded-lg hover:shadow-md transition-shadow cursor-pointer group"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-medium text-sm truncate flex-1">{topic.name}</h3>
        <div className="flex items-center gap-1">
          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
            {topic.noteCount}
          </span>
          <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>

      {/* Recent note preview */}
      {topic.recentNotes && topic.recentNotes.length > 0 && (
        <p className="text-xs text-muted-foreground line-clamp-2">
          {topic.recentNotes[0].content}
        </p>
      )}

      {/* Heat bar */}
      <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-primary/60 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(topic.noteCount * 10, 100)}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
    </motion.div>
  )
}

/**
 * ProcessingNote - Shows a note being processed
 */
function ProcessingNote({ note }: { note: ExtractedNote }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className="mb-2 p-3 bg-muted/50 border border-dashed rounded-lg"
    >
      <div className="flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-primary" />
        <span className="text-xs text-muted-foreground">
          {note.status === 'flying' ? '正在飞行...' : 'AI 分析中...'}
        </span>
      </div>
      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
        {note.content}
      </p>
    </motion.div>
  )
}

/**
 * TopicDetailPanel - Shows notes in a selected topic
 */
function TopicDetailPanel({
  topic,
  onBack,
}: {
  topic: Topic
  onBack: () => void
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 p-4 border-b">
        <button
          onClick={onBack}
          className="p-1 hover:bg-muted rounded transition-colors"
        >
          <ChevronRight className="w-4 h-4 rotate-180" />
        </button>
        <h2 className="font-semibold text-sm flex-1 truncate">{topic.name}</h2>
        <span className="text-xs text-muted-foreground">{topic.noteCount} 条笔记</span>
      </div>

      {/* Notes list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {topic.recentNotes && topic.recentNotes.length > 0 ? (
          topic.recentNotes.map((note) => (
            <motion.div
              key={note.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-3 bg-card border rounded-lg"
            >
              <p className="text-sm">{note.content}</p>
            </motion.div>
          ))
        ) : (
          <div className="text-center text-muted-foreground py-8">
            <p className="text-sm">暂无笔记</p>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * KnowledgePanel - Main panel showing extracted knowledge topics
 */
export function KnowledgePanel() {
  const noteExtraction = useNoteExtractionOptional()
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null)

  // Not available
  if (!noteExtraction) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center text-muted-foreground">
          <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="text-sm">知识提取功能未启用</p>
        </div>
      </div>
    )
  }

  const { topics, pendingNotes, isLoading } = noteExtraction

  // Show topic detail
  if (selectedTopic) {
    return (
      <TopicDetailPanel
        topic={selectedTopic}
        onBack={() => setSelectedTopic(null)}
      />
    )
  }

  // Main topic list view
  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-sm">知识主题</h2>
        {isLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
      </div>

      {/* Processing notes */}
      <AnimatePresence>
        {pendingNotes
          .filter((n) => n.status === 'processing' || n.status === 'flying')
          .map((note) => (
            <ProcessingNote key={note.id} note={note} />
          ))}
      </AnimatePresence>

      {/* Topics list */}
      {topics.length > 0 ? (
        <div className="space-y-3">
          <AnimatePresence>
            {topics.map((topic) => (
              <TopicCard
                key={topic.id}
                topic={topic}
                onClick={() => setSelectedTopic(topic)}
              />
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="text-center text-muted-foreground py-8">
          <Sparkles className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="text-sm">还没有提取任何知识</p>
          <p className="text-xs mt-2">
            选中文字并点击
            <span className="inline-flex items-center mx-1 px-1.5 py-0.5 bg-muted rounded text-foreground">
              <Sparkles className="w-3 h-3 mr-1" />
              提取
            </span>
            按钮
          </p>
        </div>
      )}
    </div>
  )
}
