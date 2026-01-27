"use client";

import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { ArrowRight, Clock, Gauge, GripVertical, Sparkles, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CourseOutline {
  title: string;
  description: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  estimatedMinutes: number;
  chapters?: {
    title: string;
    summary?: string;
    keyPoints?: string[];
  }[];
}

interface OutlineReviewProps {
  outline: CourseOutline;
  onConfirm: (outline: CourseOutline) => void;
  onRefine: (feedback: string) => void;
  isThinking: boolean;
  aiResponse: string;
}

export function OutlineReview({ outline: initialOutline, onConfirm, onRefine, isThinking, aiResponse }: OutlineReviewProps) {
  const [outline, setOutline] = useState(initialOutline);
  const [refineInput, setRefineInput] = useState("");

  // Sync internal state if props change (AI update)
  useEffect(() => {
    setOutline(initialOutline);
  }, [initialOutline]);

  const handleChapterTitleChange = (index: number, newTitle: string) => {
    const newChapters = [...(outline.chapters || [])];
    newChapters[index] = { ...newChapters[index], title: newTitle };
    setOutline({ ...outline, chapters: newChapters });
  };

  const handleTitleChange = (newTitle: string) => {
    setOutline({ ...outline, title: newTitle });
  };

  const handleRefineSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (refineInput.trim()) {
      onRefine(refineInput);
      setRefineInput("");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full max-w-4xl mx-auto p-4 md:p-0 z-50 relative flex gap-6 items-start"
    >
      <div className="flex-1 bg-white/90 backdrop-blur-xl border border-black/5 rounded-[32px] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-8 border-b border-black/5 bg-gradient-to-br from-white to-black/[0.02]">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-black text-white text-xs font-bold px-2 py-1 rounded-full uppercase tracking-wider">
                  Course Outline
                </span>
                <span className="text-black/40 text-xs font-medium uppercase tracking-wider flex items-center gap-1">
                   {outline.chapters?.length || 0} Chapters
                </span>
              </div>
              <input
                value={outline.title}
                onChange={(e) => handleTitleChange(e.target.value)}
                className="text-3xl md:text-4xl font-black text-black bg-transparent border-none focus:ring-0 p-0 w-full placeholder:text-black/20"
                placeholder="Course Title"
              />
              <p className="text-black/60 text-lg leading-relaxed max-w-2xl">
                {outline.description}
              </p>
            </div>
            
            <div className="flex gap-4 items-center">
              <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-2 text-sm font-medium text-black/60">
                  <Clock className="w-4 h-4" />
                  {outline.estimatedMinutes} min
                </div>
                <div className="flex items-center gap-2 text-sm font-medium text-black/60 capitalize">
                  <Gauge className="w-4 h-4" />
                  {outline.difficulty}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Chapters List */}
        <div className="p-8 max-h-[50vh] overflow-y-auto custom-scrollbar">
          <div className="space-y-4">
            {(outline.chapters || []).map((chapter, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="group flex gap-4 p-4 rounded-2xl hover:bg-black/[0.02] border border-transparent hover:border-black/5 transition-all"
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-black/5 flex items-center justify-center text-sm font-bold text-black/40 group-hover:bg-black group-hover:text-white transition-colors">
                  {index + 1}
                </div>
                <div className="flex-1 space-y-1">
                  <input
                    value={chapter.title}
                    onChange={(e) => handleChapterTitleChange(index, e.target.value)}
                    className="w-full bg-transparent font-bold text-lg text-black focus:outline-none focus:underline decoration-black/20 underline-offset-4"
                  />
                  <p className="text-sm text-black/50 leading-relaxed">
                    {chapter.summary}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {(chapter.keyPoints || []).slice(0, 3).map((kp, kpi) => (
                      <span key={kpi} className="text-[10px] font-medium px-2 py-0.5 bg-black/5 rounded-full text-black/60">
                        {kp}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="opacity-0 group-hover:opacity-100 flex items-center text-black/20 cursor-grab active:cursor-grabbing">
                  <GripVertical className="w-5 h-5" />
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 bg-black/5 border-t border-black/5 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <p className="text-xs text-black/40 font-medium px-2">
              * Click text to edit manually
            </p>
          </div>
          <Button 
            onClick={() => onConfirm(outline)}
            size="lg" 
            className="rounded-full bg-black text-white hover:bg-black/80 px-8 text-lg font-bold shadow-xl shadow-black/10 group"
          >
            Start Learning
            <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>
      </div>

      {/* AI Refinement Chat - Sidebar */}
      <div className="w-80 bg-white/90 backdrop-blur-xl border border-black/5 rounded-[32px] shadow-xl p-6 flex flex-col gap-4 self-stretch">
        <div className="flex items-center gap-2 text-black/60">
          <Sparkles className="w-5 h-5" />
          <h3 className="font-bold text-sm uppercase tracking-wider">AI Assistant</h3>
        </div>
        
        <div className="flex-1 overflow-y-auto min-h-[100px] text-sm text-black/70 space-y-4">
           {aiResponse ? (
             <div className="bg-black/5 p-4 rounded-2xl rounded-tl-none">
               {aiResponse}
             </div>
           ) : (
             <div className="text-black/30 italic text-center mt-10">
               "Ask me to adjust the difficulty, add topics, or change the structure."
             </div>
           )}
        </div>

        <form onSubmit={handleRefineSubmit} className="relative">
          <input
            value={refineInput}
            onChange={(e) => setRefineInput(e.target.value)}
            disabled={isThinking}
            placeholder={isThinking ? "Thinking..." : "e.g. Make it harder..."}
            className="w-full bg-black/[0.03] border border-black/5 rounded-2xl px-4 py-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-black/5 disabled:opacity-50"
          />
          <button 
            type="submit"
            disabled={!refineInput.trim() || isThinking}
            className="absolute right-2 top-2 p-1.5 bg-black text-white rounded-xl hover:bg-black/80 disabled:opacity-0 transition-all"
          >
            <ArrowRight className="w-3 h-3" />
          </button>
        </form>
      </div>
    </motion.div>
  );
}
