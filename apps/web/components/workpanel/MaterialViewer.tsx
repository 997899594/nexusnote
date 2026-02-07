"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Book,
  ChevronDown,
  List,
  Layers,
  PlayCircle,
  Sparkles,
  Info,
  BookmarkPlus,
  History,
  MessageSquare,
  MoreVertical,
  ExternalLink,
  Calendar,
  User,
  Hash,
} from "lucide-react";
import { useNoteExtractionOptional } from "@/contexts/NoteExtractionContext";
import { GhostFlight } from "@/components/editor/GhostFlight";
import { markdownToHtml } from "@/lib/editor/markdown";

interface MaterialViewerProps {
  title: string;
  documentId?: string;
}

export function MaterialViewer({ title, documentId }: MaterialViewerProps) {
  const [activeTab, setActiveTab] = useState<"content" | "details" | "notes">(
    "content",
  );
  const [flyingNotes, setFlyingNotes] = useState<any[]>([]);
  const [selection, setSelection] = useState<{
    text: string;
    rect: DOMRect;
  } | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const noteExtraction = useNoteExtractionOptional();
  const [content, setContent] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [docInfo, setDocInfo] = useState<any>(null);

  // Fetch document content if documentId is provided
  useEffect(() => {
    if (!documentId) {
      setIsLoading(false);
      return;
    }
    const fetchContent = async () => {
      try {
        const res = await fetch(`/api/documents/${documentId}`);
        if (res.ok) {
          const doc = await res.json();
          setContent(doc.content || "");
          setDocInfo(doc);
        }
      } catch (err) {
        console.error("Failed to fetch document content:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchContent();
  }, [documentId]);

  const [chapters] = useState([
    { id: "ch1", title: "所有权模型基础", active: true },
    { id: "ch2", title: "引用与借用", active: false },
    { id: "ch3", title: "生命周期详解", active: false },
    { id: "ch4", title: "智能指针应用", active: false },
  ]);

  // Handle text selection
  useEffect(() => {
    const handleMouseUp = () => {
      const sel = window.getSelection();
      if (sel && sel.toString().trim().length > 5) {
        // Only show if selection is within contentRef
        if (contentRef.current?.contains(sel.anchorNode)) {
          const range = sel.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          setSelection({ text: sel.toString().trim(), rect });
        }
      } else {
        setSelection(null);
      }
    };

    document.addEventListener("mouseup", handleMouseUp);
    return () => document.removeEventListener("mouseup", handleMouseUp);
  }, []);

  const handleExtractNote = useCallback(() => {
    if (!selection || !noteExtraction) return;

    const tempId = crypto.randomUUID();
    setFlyingNotes((prev) => [
      ...prev,
      { id: tempId, content: selection.text, startRect: selection.rect },
    ]);

    noteExtraction.extractNote(selection.text, selection.rect, {
      sourceType: "document",
      documentId,
      position: { from: 0, to: 0 },
    });

    setSelection(null);
    window.getSelection()?.removeAllRanges();
  }, [selection, noteExtraction, documentId]);

  const handleFlightComplete = (id: string) => {
    setFlyingNotes((prev) => prev.filter((n) => n.id !== id));
  };

  // Filter topics related to this document (if possible, or just show all)
  const relatedTopics = noteExtraction?.topics || [];

  return (
    <div className="h-full flex flex-col gap-0 relative bg-white/40 backdrop-blur-xl rounded-[32px] overflow-hidden border border-black/[0.03] shadow-2xl shadow-black/[0.02]">
      {/* Material Header & Tabs */}
      <div className="p-8 pb-0 bg-white/40 border-b border-black/[0.02]">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-5">
            <div className="w-12 h-12 rounded-[22px] bg-black flex items-center justify-center text-white shadow-xl shadow-black/10 ring-4 ring-black/5">
              <Book className="w-6 h-6" />
            </div>
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-black/30">
                  Reading Mode
                </span>
                <span className="w-1 h-1 rounded-full bg-black/10" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">
                  Active
                </span>
              </div>
              <h1 className="text-lg font-black text-black tracking-tight truncate max-w-[280px]">
                {title}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button className="p-2.5 text-black/30 hover:text-black hover:bg-black/5 rounded-2xl transition-all group">
              <ExternalLink className="w-4 h-4 group-hover:scale-110 transition-transform" />
            </button>
            <button className="p-2.5 text-black/30 hover:text-black hover:bg-black/5 rounded-2xl transition-all group">
              <MoreVertical className="w-4 h-4 group-hover:scale-110 transition-transform" />
            </button>
          </div>
        </div>

        <div className="flex gap-8">
          {[
            { id: "content", label: "正文阅读", icon: Layers },
            { id: "details", label: "详情信息", icon: Info },
            { id: "notes", label: "知识提取", icon: BookmarkPlus },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2.5 pb-5 text-[11px] font-black uppercase tracking-[0.15em] transition-all relative group ${
                activeTab === tab.id
                  ? "text-black"
                  : "text-black/25 hover:text-black/40"
              }`}
            >
              <tab.icon
                className={`w-4 h-4 transition-transform ${activeTab === tab.id ? "scale-110" : "group-hover:scale-110"}`}
              />
              {tab.label}
              {activeTab === tab.id && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-black rounded-full"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Main View Area */}
      <div className="flex-1 overflow-hidden relative bg-white/20">
        <AnimatePresence mode="wait">
          {activeTab === "content" && (
            <motion.div
              key="content"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="h-full flex flex-col"
            >
              {/* Reading Core */}
              <div
                className="flex-1 px-12 py-12 overflow-y-auto custom-scrollbar scroll-smooth"
                ref={contentRef}
              >
                <div className="max-w-2xl mx-auto">
                  {isLoading ? (
                    <div className="flex flex-col gap-8 animate-pulse">
                      <div className="h-4 w-1/3 bg-black/5 rounded-full mx-auto" />
                      <div className="h-12 w-3/4 bg-black/5 rounded-2xl mx-auto" />
                      <div className="space-y-4">
                        <div className="h-4 w-full bg-black/5 rounded-full" />
                        <div className="h-4 w-full bg-black/5 rounded-full" />
                        <div className="h-4 w-5/6 bg-black/5 rounded-full" />
                      </div>
                    </div>
                  ) : content ? (
                    <div className="prose prose-neutral prose-sm max-w-none leading-relaxed text-black/70 selection:bg-black selection:text-white">
                      <div
                        dangerouslySetInnerHTML={{
                          __html: markdownToHtml(content),
                        }}
                      />
                    </div>
                  ) : (
                    <div className="prose prose-neutral prose-sm max-w-none leading-relaxed text-black/70">
                      <div className="flex items-center gap-3 mb-8">
                        <div className="h-px flex-1 bg-black/[0.03]" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-black/20">
                          Demo Content
                        </span>
                        <div className="h-px flex-1 bg-black/[0.03]" />
                      </div>

                      <h1 className="text-3xl font-black tracking-tighter mb-12 text-black leading-tight">
                        系统级思考的艺术：从底层逻辑构建认知边界
                      </h1>

                      <div className="space-y-8 text-base font-medium">
                        <p className="first-letter:text-4xl first-letter:font-black first-letter:mr-3 first-letter:float-left first-letter:text-black">
                          在探讨现代高性能计算时，我们不能忽略底层资源的分配逻辑。Rust
                          语言通过一套独特的所有权模型，
                          在不需要垃圾回收的情况下，实现了内存安全性。这一设计彻底解决了
                          C/C++ 中困扰开发者数十年的悬垂指针与内存竞态问题。
                        </p>

                        <p>
                          我们将这种范式称为“所有权机制”，它在编译阶段就确定了内存的生命周期，从而消除了运行时的不确定性。
                          这不仅是技术的革新，更是编程思维的一次跃迁。
                        </p>

                        <div className="my-16 aspect-video bg-black rounded-[40px] flex items-center justify-center border border-black/[0.04] relative group cursor-pointer overflow-hidden transition-all hover:scale-[1.02] shadow-2xl shadow-black/20">
                          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1633356122544-f134324a6cee?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-40 group-hover:scale-110 transition-transform duration-1000" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60" />
                          <div className="relative z-10 flex flex-col items-center gap-6">
                            <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform">
                              <PlayCircle className="w-10 h-10 text-black fill-black/5" />
                            </div>
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-white font-black tracking-widest text-[10px] uppercase">
                                Watch Lesson
                              </span>
                              <span className="text-white/40 text-[9px] font-bold">
                                12:45 • High Quality
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 my-12 p-8 rounded-[32px] bg-emerald-50/50 border border-emerald-100/50">
                          <div className="w-12 h-12 rounded-2xl bg-emerald-500 flex items-center justify-center text-white shrink-0">
                            <Sparkles className="w-6 h-6" />
                          </div>
                          <div>
                            <h4 className="text-emerald-900 font-black text-sm mb-1">
                              关键知识点
                            </h4>
                            <p className="text-emerald-700/70 text-xs font-bold leading-relaxed">
                              所有权模型是 Rust
                              的核心特征，它确保了在不损失性能的前提下实现内存安全。
                            </p>
                          </div>
                        </div>

                        <h3 className="text-xl font-black mt-16 mb-8 text-black tracking-tight flex items-center gap-4">
                          <span className="w-8 h-8 rounded-xl bg-black/5 flex items-center justify-center text-xs">
                            01
                          </span>
                          零成本抽象与性能边界
                        </h3>

                        <p>
                          零成本抽象意味着您在享用高级抽象语法的同时，不会产生任何额外的性能损耗。
                          Rust 编译器会将这些高级构造直接映射为最优的机器码。
                        </p>

                        <blockquote className="border-l-[6px] border-black bg-black/[0.02] p-10 rounded-r-[40px] my-16 relative">
                          <MessageSquare className="absolute -top-4 -left-4 w-10 h-10 text-black/5" />
                          <p className="text-xl font-black italic text-black/80 leading-snug">
                            “所有权不仅是技术约束，更是开发者与编译器之间关于内存生命周期的安全契约。”
                          </p>
                          <cite className="block mt-6 text-[10px] font-black uppercase tracking-widest text-black/40">
                            — 核心开发团队格言
                          </cite>
                        </blockquote>
                      </div>
                    </div>
                  )}
                </div>

                {/* Selection Tooltip */}
                <AnimatePresence>
                  {selection && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9, y: 10 }}
                      className="fixed z-50 pointer-events-auto"
                      style={{
                        left: selection.rect.left + selection.rect.width / 2,
                        top: selection.rect.top - 70,
                        transform: "translateX(-50%)",
                      }}
                    >
                      <button
                        onClick={handleExtractNote}
                        className="flex items-center gap-3 px-6 py-4 bg-black text-white rounded-[24px] shadow-2xl shadow-black/40 hover:scale-105 active:scale-95 transition-all text-[11px] font-black uppercase tracking-[0.2em] group ring-8 ring-black/5"
                      >
                        <BookmarkPlus className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                        提取到知识库
                      </button>
                      <div className="absolute bottom-[-6px] left-1/2 -translate-x-1/2 w-4 h-4 bg-black rotate-45" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Course Directory Footer */}
              <div className="px-8 py-6 border-t border-black/[0.03] bg-white/60 backdrop-blur-xl">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-lg bg-black/5 flex items-center justify-center">
                      <List className="w-3 h-3 text-black/40" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-black/40">
                      Course Directory
                    </span>
                  </div>
                  <span className="text-[9px] font-bold text-black/20">
                    4 Chapters • 120 Mins
                  </span>
                </div>
                <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
                  {chapters.map((ch) => (
                    <button
                      key={ch.id}
                      className={`shrink-0 px-6 py-3.5 rounded-2xl text-[11px] font-black transition-all border group relative overflow-hidden ${
                        ch.active
                          ? "bg-black text-white border-black shadow-xl shadow-black/10"
                          : "bg-white text-black/40 border-black/[0.03] hover:border-black/10 hover:text-black hover:bg-black/[0.01]"
                      }`}
                    >
                      <span className="relative z-10">{ch.title}</span>
                      {ch.active && (
                        <motion.div
                          layoutId="activeChapterGlow"
                          className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0"
                          animate={{ x: ["-100%", "100%"] }}
                          transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: "linear",
                          }}
                        />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "details" && (
            <motion.div
              key="details"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="h-full p-12 overflow-y-auto custom-scrollbar"
            >
              <div className="max-w-xl mx-auto space-y-12">
                <div className="relative p-10 rounded-[40px] bg-black text-white overflow-hidden shadow-2xl shadow-black/20">
                  <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
                        <Sparkles className="w-4 h-4 text-emerald-400" />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
                        Document Insights
                      </span>
                    </div>
                    <h3 className="text-2xl font-black mb-4 leading-tight">
                      {docInfo?.title || title}
                    </h3>
                    <p className="text-white/60 text-sm font-medium leading-relaxed">
                      {docInfo?.description ||
                        "这是一份深度内化的学习材料。通过左侧的阅读区域，你可以自由提取知识点并将其转化为永久记忆。"}
                    </p>
                  </div>
                  <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px]" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {[
                    {
                      icon: User,
                      label: "Author",
                      value: docInfo?.author || "System AI",
                      color: "bg-blue-500",
                    },
                    {
                      icon: Calendar,
                      label: "Created",
                      value: docInfo?.createdAt
                        ? new Date(docInfo.createdAt).toLocaleDateString()
                        : "Feb 7, 2026",
                      color: "bg-purple-500",
                    },
                    {
                      icon: Hash,
                      label: "Size",
                      value: `${content?.length || 0} chars`,
                      color: "bg-orange-500",
                    },
                    {
                      icon: History,
                      label: "Status",
                      value: "Deep Learning",
                      color: "bg-rose-500",
                    },
                  ].map((item, i) => (
                    <div
                      key={i}
                      className="group p-6 rounded-[32px] bg-white border border-black/[0.03] hover:border-black/10 transition-all hover:shadow-xl hover:shadow-black/[0.02]"
                    >
                      <div
                        className={`w-10 h-10 rounded-2xl ${item.color} flex items-center justify-center text-white mb-4 shadow-lg shadow-black/5 group-hover:scale-110 transition-transform`}
                      >
                        <item.icon className="w-5 h-5" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase tracking-widest text-black/20 mb-1">
                          {item.label}
                        </span>
                        <span className="text-sm font-black text-black">
                          {item.value}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "notes" && (
            <motion.div
              key="notes"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="h-full flex flex-col p-12 overflow-y-auto custom-scrollbar"
            >
              <div className="max-w-xl mx-auto w-full space-y-8">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex flex-col">
                    <h2 className="text-xl font-black tracking-tight">
                      知识库关联
                    </h2>
                    <p className="text-xs text-black/40 font-medium mt-1">
                      从该文档中提取的所有知识点
                    </p>
                  </div>
                  <div className="px-3 py-1 bg-black text-white rounded-full text-[9px] font-black uppercase tracking-widest">
                    {relatedTopics.length} Topics
                  </div>
                </div>

                {relatedTopics.length > 0 ? (
                  <div className="grid gap-4">
                    {relatedTopics.map((topic) => (
                      <motion.div
                        key={topic.id}
                        layout
                        className="p-6 bg-white border border-black/[0.03] rounded-[32px] hover:shadow-xl hover:shadow-black/[0.02] transition-all group"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-black/5 flex items-center justify-center group-hover:bg-black group-hover:text-white transition-all">
                              <Layers className="w-5 h-5" />
                            </div>
                            <div>
                              <h3 className="font-black text-sm tracking-tight">
                                {topic.name}
                              </h3>
                              <span className="text-[10px] text-black/30 font-bold">
                                {topic.noteCount} 个笔记
                              </span>
                            </div>
                          </div>
                          <ChevronDown className="w-4 h-4 text-black/20" />
                        </div>

                        {topic.recentNotes && topic.recentNotes.length > 0 && (
                          <div className="space-y-3">
                            {topic.recentNotes.slice(0, 2).map((note) => (
                              <div
                                key={note.id}
                                className="p-4 bg-black/[0.02] rounded-2xl border border-black/[0.02]"
                              >
                                <p className="text-xs text-black/60 leading-relaxed line-clamp-2 italic">
                                  "{note.content}"
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center text-center py-20 opacity-20">
                    <BookmarkPlus className="w-16 h-16 mb-6" />
                    <p className="text-sm font-black uppercase tracking-widest">
                      暂无提取内容
                    </p>
                    <p className="text-xs mt-2">在阅读模式下选中文字即可提取</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Ghost Flight Animations */}
      <AnimatePresence>
        {flyingNotes.map((note) => (
          <GhostFlight
            key={note.id}
            id={note.id}
            content={note.content}
            startRect={note.startRect}
            onComplete={() => handleFlightComplete(note.id)}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
