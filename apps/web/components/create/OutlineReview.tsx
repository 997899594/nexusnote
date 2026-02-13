"use client";

import type { UIMessage } from "ai";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Clock, Gauge, MessageCircle, Sparkles, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { getMessageContent } from "@/lib/ai/ui-utils";

interface CourseOutline {
  title: string;
  description: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  estimatedMinutes: number;
  modules?: {
    title: string;
    chapters: {
      title: string;
      summary?: string;
      keyPoints?: string[];
      contentSnippet?: string;
    }[];
  }[];
  chapters?: {
    title: string;
    summary?: string;
    keyPoints?: string[];
    contentSnippet?: string;
  }[];
}

interface OutlineReviewProps {
  outline: CourseOutline;
  onConfirm: (outline: CourseOutline) => void;
  onRefine: (feedback: string) => void;
  isThinking: boolean;
  messages: UIMessage[];
}

export function OutlineReview({
  outline: initialOutline,
  onConfirm,
  onRefine,
  isThinking,
  messages,
}: OutlineReviewProps) {
  const [outline, setOutline] = useState(initialOutline);
  const [refineInput, setRefineInput] = useState("");

  useEffect(() => {
    setOutline(initialOutline);
  }, [initialOutline]);

  const latestAiMessage = (() => {
    const assistantMessages = messages.filter((m) => m.role === "assistant");
    const lastMessage = assistantMessages[assistantMessages.length - 1];
    return lastMessage ? getMessageContent(lastMessage) : "";
  })();

  const chapters = outline.chapters ?? outline.modules?.flatMap((m) => m.chapters) ?? [];

  const handleRefineSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (refineInput.trim()) {
      onRefine(refineInput);
      setRefineInput("");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-5xl mx-auto p-4 md:p-0 z-50 relative flex flex-col md:flex-row gap-8 items-start max-h-[90vh]"
    >
      {/* Main Outline Card */}
      <div className="flex-1 bg-white/70 backdrop-blur-2xl border border-black/[0.06] rounded-[40px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] overflow-hidden flex flex-col self-stretch">
        {/* Header Section */}
        <div className="p-8 pb-4 relative overflow-hidden">
          {/* Subtle background glow */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-black/[0.02] blur-3xl rounded-full -mr-20 -mt-20" />

          <div className="relative z-10 space-y-4">
            <div className="flex items-center gap-3">
              <span className="bg-black text-white text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-[0.2em]">
                Manifesting Plan
              </span>
              <div className="h-4 w-px bg-black/10" />
              <span className="text-black/40 text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3" />
                {chapters.length} 核心章节
              </span>
            </div>

            <h1 className="text-3xl md:text-4xl font-black text-black tracking-tight leading-tight">
              {outline.title}
            </h1>

            <p className="text-black/50 text-base leading-relaxed max-w-2xl font-medium line-clamp-2">
              {outline.description}
            </p>

            <div className="flex flex-wrap gap-4 pt-1">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-black/[0.03] rounded-xl border border-black/[0.03]">
                <Clock className="w-3.5 h-3.5 text-black/40" />
                <span className="text-xs font-bold text-black/60">
                  {outline.estimatedMinutes} 分钟
                </span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-black/[0.03] rounded-xl border border-black/[0.03]">
                <Gauge className="w-3.5 h-3.5 text-black/40" />
                <span className="text-xs font-bold text-black/60 capitalize">
                  {outline.difficulty === "beginner"
                    ? "初级入门"
                    : outline.difficulty === "intermediate"
                      ? "中级进阶"
                      : "高级专家"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Chapters List */}
        <div className="flex-1 p-8 pt-0 overflow-y-auto custom-scrollbar">
          <div className="space-y-2">
            {chapters.map((chapter, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04, duration: 0.6 }}
                className="group p-6 rounded-3xl bg-black/[0.01] hover:bg-black/[0.03] border border-black/[0.03] hover:border-black/[0.08] transition-all duration-500 flex gap-6"
              >
                <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-white border border-black/[0.05] shadow-sm flex items-center justify-center text-sm font-black text-black/20 group-hover:bg-black group-hover:text-white group-hover:border-black transition-all duration-500">
                  {String(index + 1).padStart(2, "0")}
                </div>
                <div className="flex-1 space-y-2">
                  <h3 className="font-black text-xl text-black tracking-tight group-hover:translate-x-1 transition-transform duration-500">
                    {chapter.title}
                  </h3>
                  {(chapter.summary || chapter.contentSnippet) && (
                    <p className="text-sm text-black/40 leading-relaxed font-medium">
                      {chapter.summary || chapter.contentSnippet}
                    </p>
                  )}
                  {chapter.keyPoints && chapter.keyPoints.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {chapter.keyPoints.slice(0, 3).map((kp, kpi) => (
                        <span
                          key={kpi}
                          className="text-[10px] font-black px-2.5 py-1 bg-black/5 rounded-full text-black/40 uppercase tracking-wider"
                        >
                          {kp}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Action Footer */}
        <div className="p-8 bg-black/[0.02] border-t border-black/[0.04] flex justify-between items-center">
          <div className="text-black/30 text-xs font-bold uppercase tracking-widest">
            准备就绪 • 点击开始深度学习
          </div>
          <Button
            onClick={() => onConfirm(outline)}
            size="lg"
            className="rounded-2xl bg-black text-white hover:bg-zinc-800 px-10 py-7 text-lg font-black shadow-2xl shadow-black/20 group transition-all duration-500"
          >
            开始生成全文
            <ArrowRight className="w-6 h-6 ml-3 group-hover:translate-x-2 transition-transform duration-500" />
          </Button>
        </div>
      </div>

      {/* AI Sidepanel */}
      <div className="w-full md:w-80 flex flex-col gap-4 self-stretch">
        <div className="flex-1 bg-zinc-900 text-white rounded-[40px] shadow-2xl p-6 flex flex-col gap-4 relative overflow-hidden group">
          {/* Animated background particles effect */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-white/10 transition-colors duration-700" />

          <div className="flex items-center gap-3 relative z-10">
            <div className="p-2 bg-white/10 rounded-xl">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <h3 className="font-black text-xs uppercase tracking-widest">AI 调优助手</h3>
          </div>

          <div className="flex-1 overflow-y-auto text-xs leading-relaxed relative z-10 scrollbar-hide">
            <AnimatePresence mode="wait">
              {latestAiMessage ? (
                <motion.div
                  key={latestAiMessage}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-3"
                >
                  <div className="text-white/70 font-medium">{latestAiMessage}</div>
                </motion.div>
              ) : (
                <div className="text-white/30 font-medium italic mt-2">
                  "觉得内容太简单？想增加更多实战？直接告诉我。"
                </div>
              )}
            </AnimatePresence>
          </div>

          <form onSubmit={handleRefineSubmit} className="relative z-10">
            <input
              value={refineInput}
              onChange={(e) => setRefineInput(e.target.value)}
              disabled={isThinking}
              placeholder={isThinking ? "思考中..." : "输入调整意见..."}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 pr-10 text-xs text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-white/20 transition-all disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!refineInput.trim() || isThinking}
              className="absolute right-2 top-2 p-1.5 bg-white text-black rounded-lg hover:bg-zinc-200 disabled:opacity-0 transition-all duration-300"
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
            </button>
          </form>
        </div>

        {/* Feedback small card */}
        <div className="bg-white/50 backdrop-blur-xl border border-black/[0.04] rounded-3xl p-5">
          <div className="flex items-center gap-2 text-black/40">
            <MessageCircle className="w-3.5 h-3.5" />
            <span className="text-[10px] font-black uppercase tracking-widest">专家模式已开启</span>
          </div>
          <p className="mt-1.5 text-[10px] text-black/50 leading-relaxed font-medium">
            已根据您的认知风格（{outline.difficulty}）优化。
          </p>
        </div>
      </div>
    </motion.div>
  );
}
