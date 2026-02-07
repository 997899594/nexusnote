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
      className="p-5 bg-white/40 backdrop-blur-xl border border-black/[0.03] rounded-[24px] hover:shadow-xl hover:shadow-black/[0.02] transition-all cursor-pointer group relative overflow-hidden"
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-3 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-black/5 flex items-center justify-center group-hover:bg-black group-hover:text-white transition-all">
            <BookOpen className="w-4 h-4" />
          </div>
          <h3 className="font-black text-sm tracking-tight truncate max-w-[140px] text-black/80">{topic.name}</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black bg-black text-white px-2 py-1 rounded-lg shadow-lg shadow-black/10">
            {topic.noteCount}
          </span>
          <ChevronRight className="w-4 h-4 text-black/20 group-hover:text-black group-hover:translate-x-1 transition-all" />
        </div>
      </div>

      {/* Recent note preview */}
      {topic.recentNotes && topic.recentNotes.length > 0 && (
        <p className="text-[11px] text-black/40 line-clamp-2 font-medium leading-relaxed relative z-10">
          {topic.recentNotes[0].content}
        </p>
      )}

      {/* Background Glow */}
      <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-black/[0.01] rounded-full blur-2xl group-hover:bg-black/[0.03] transition-colors" />
    </motion.div>
  )
}

/**
 * ProcessingNote - Shows a note being processed
 */
function ProcessingNote({ note }: { note: ExtractedNote }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="mb-4 p-4 bg-emerald-500/[0.03] border border-emerald-500/10 border-dashed rounded-[20px] relative overflow-hidden"
    >
      <div className="flex items-center gap-3 relative z-10">
        <div className="relative">
          <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
          <motion.div 
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute inset-0 bg-emerald-500/20 blur-sm rounded-full"
          />
        </div>
        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">
          {note.status === 'flying' ? 'Transmitting...' : 'AI Synthesizing...'}
        </span>
      </div>
      <p className="text-[11px] text-emerald-900/40 mt-2 line-clamp-1 font-medium italic">
        "{note.content}"
      </p>
      
      {/* Scanning effect */}
      <motion.div 
        animate={{ x: ['-100%', '200%'] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
        className="absolute inset-y-0 w-20 bg-gradient-to-r from-transparent via-emerald-500/[0.05] to-transparent skew-x-12"
      />
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
    <div className="flex flex-col h-full bg-white/20">
      {/* Header */}
      <div className="flex items-center gap-4 p-6 border-b border-black/[0.02] bg-white/40 backdrop-blur-xl shrink-0">
        <button
          onClick={onBack}
          className="p-2.5 hover:bg-black/5 rounded-2xl transition-all group"
        >
          <ChevronRight className="w-5 h-5 rotate-180 text-black/20 group-hover:text-black transition-colors" />
        </button>
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-black/20">Topic Detail</span>
            <span className="w-1 h-1 rounded-full bg-black/10" />
            <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">{topic.noteCount} Notes</span>
          </div>
          <h2 className="font-black text-base text-black tracking-tight truncate mt-0.5">{topic.name}</h2>
        </div>
      </div>

      {/* Notes list */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
        {topic.recentNotes && topic.recentNotes.length > 0 ? (
          topic.recentNotes.map((note, idx) => (
            <motion.div
              key={note.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="p-5 bg-white/60 border border-black/[0.03] rounded-[24px] shadow-sm hover:shadow-md transition-shadow group"
            >
              <div className="flex items-start gap-4">
                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-black/10 group-hover:bg-black transition-colors shrink-0" />
                <p className="text-[13px] leading-relaxed text-black/70 font-medium">{note.content}</p>
              </div>
            </motion.div>
          ))
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-30">
            <div className="w-16 h-16 rounded-[24px] bg-black/[0.02] flex items-center justify-center mb-4">
              <BookOpen className="w-8 h-8" />
            </div>
            <p className="text-xs font-black uppercase tracking-widest">No notes found</p>
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
      <div className="flex-1 flex items-center justify-center p-10">
        <div className="text-center">
          <div className="w-20 h-20 rounded-[32px] bg-black/[0.02] border border-black/[0.04] flex items-center justify-center mx-auto mb-6">
            <BookOpen className="w-8 h-8 text-black/10" />
          </div>
          <h3 className="text-sm font-black text-black/20 uppercase tracking-[0.2em]">Functionality Offline</h3>
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
    <div className="flex-1 flex flex-col min-h-0 bg-white/20">
      <div className="p-6 pb-2 flex items-center justify-between shrink-0">
        <div className="flex flex-col">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-black/20">Knowledge Base</span>
          <h2 className="text-sm font-bold text-black mt-1">原子知识库</h2>
        </div>
        {isLoading && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-black/[0.03] rounded-full">
            <Loader2 className="w-3 h-3 animate-spin text-black/40" />
            <span className="text-[9px] font-black uppercase tracking-widest text-black/40">Syncing</span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
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
          <div className="grid gap-4">
            <AnimatePresence>
              {topics.map((topic, idx) => (
                <TopicCard
                  key={topic.id}
                  topic={topic}
                  onClick={() => setSelectedTopic(topic)}
                />
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-[200px] mx-auto py-20">
            <div className="relative mb-8">
              <div className="w-20 h-20 rounded-[32px] bg-black/[0.02] border border-black/[0.04] flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-black/5" />
              </div>
              <motion.div 
                animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 3, repeat: Infinity }}
                className="absolute inset-0 bg-black/5 blur-xl rounded-full"
              />
            </div>
            <h3 className="text-base font-black text-black mb-2 tracking-tight">空空如也</h3>
            <p className="text-[11px] text-black/30 font-medium leading-relaxed">
              在阅读过程中选中精彩段落，点击“提取”将其转化为永久知识。
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
