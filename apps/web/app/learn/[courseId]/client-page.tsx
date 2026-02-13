"use client";

import { useChat } from "@ai-sdk/react";
import type { DynamicToolUIPart } from "ai";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, ChevronLeft, Menu, MessageSquare, Sparkles } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCourseChaptersAction, updateCourseProgressAction } from "@/app/actions/course";
import { MessageResponse } from "@/components/ai/Message";
import { UnifiedChatUI } from "@/components/ai/UnifiedChatUI";
import { MindMapView, QuizResult, SummaryResult, WebSearchResult } from "@/components/ai/ui";
import { ContentRenderer } from "@/components/course/content-renderer";
import { OrganicHeader } from "@/components/create/OrganicHeader";
import type { CourseChapterDTO, CourseProfileDTO } from "@/lib/actions/types";
import type { ChatAgentMessage } from "@/lib/ai/agents/chat-agent";
import type { CourseGenerationAgentMessage } from "@/lib/ai/agents/course-generation/agent";
import type {
  MindMapOutput,
  QuizOutput,
  SummarizeOutput,
  WebSearchOutput,
} from "@/lib/ai/tools/types";
import type { OutlineData } from "@/features/shared/ai/types/course";
import { getMessageContent } from "@/features/shared/ai/ui-utils";

interface LearnPageClientProps {
  courseId: string;
  initialProfile: CourseProfileDTO;
}

export default function LearnPageClient({ courseId, initialProfile }: LearnPageClientProps) {
  const [courseProfile] = useState<CourseProfileDTO>(initialProfile);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [currentChapterId, setCurrentChapterId] = useState<string | null>(null);
  const [chapters, setChapters] = useState<CourseChapterDTO[]>([]);
  const [_isGenerationComplete, _setIsGenerationComplete] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(true);

  // 防止并发生成的 ref
  const generatingChapterRef = useRef<Set<string>>(new Set());
  const _generationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [_isInitialLoading, setIsInitialLoading] = useState(true);

  // 课程生成用的 useChat（不显示在聊天框）
  const {
    messages: generationMessages,
    sendMessage: generateChapter,
    status: generationStatus,
  } = useChat<CourseGenerationAgentMessage>({
    id: `course-generation-${courseId}`,
  });

  // 加载章节的函数
  const loadChapters = useCallback(async () => {
    try {
      const result = await getCourseChaptersAction(courseId);
      if (result.success) {
        setChapters(result.data.chapters);
        setIsInitialLoading(false);
      }
    } catch (err) {
      console.error("[LearnPageClient] Failed to load chapters:", err);
      setIsInitialLoading(false);
    }
  }, [courseId]);

  // 初始加载已生成的章节
  useEffect(() => {
    loadChapters();
  }, [loadChapters]);

  // 1. 路由优先：当章节列表加载完成，或 URL 参数变化时，同步当前索引
  useEffect(() => {
    const chapterIdFromUrl = searchParams.get("chapterId");
    if (chapters.length > 0) {
      if (chapterIdFromUrl) {
        const chapter = chapters.find((c) => c.id === chapterIdFromUrl);
        if (chapter) {
          setCurrentChapterId(chapter.id);
        }
      } else if (!currentChapterId) {
        // 如果 URL 没带 ID 且当前未选中，默认选中第一个已生成的章节
        const firstGenerated = [...chapters].sort((a, b) => a.chapterIndex - b.chapterIndex)[0];
        if (firstGenerated) {
          setCurrentChapterId(firstGenerated.id);
        }
      }
    }
  }, [chapters, searchParams, currentChapterId]);

  // 2. 状态同步：当用户切换章节时，静默更新 URL
  useEffect(() => {
    const currentChapter = chapters.find((c) => c.id === currentChapterId);
    if (currentChapter?.id) {
      const newUrl = `${window.location.pathname}?chapterId=${currentChapter.id}`;
      // 使用 replaceState 静默更新 URL，不触发页面刷新
      window.history.replaceState({ ...window.history.state, as: newUrl, url: newUrl }, "", newUrl);
    }
  }, [currentChapterId, chapters]);

  const outline = useMemo(
    () => courseProfile.outlineData as OutlineData,
    [courseProfile.outlineData],
  );

  // 课程大纲中的总章节数
  const totalChapters = useMemo(() => {
    return (
      outline?.modules
        ?.map((m) => m.chapters.length)
        .reduce((sum: number, len: number) => sum + len, 0) || 0
    );
  }, [outline]);

  // 进度同步：当用户切换章节时，同步到服务器
  useEffect(() => {
    const syncProgress = async () => {
      const currentChapter = chapters.find((c) => c.id === currentChapterId);
      if (currentChapter) {
        await updateCourseProgressAction({
          courseId,
          currentChapter: currentChapter.chapterIndex,
        });
      }
    };

    syncProgress();
  }, [courseId, currentChapterId, chapters.find]);

  // 监听课程生成消息，重新从数据库加载章节
  useEffect(() => {
    const lastMessage = generationMessages[generationMessages.length - 1];
    if (!lastMessage) return;

    const toolCall = lastMessage.parts?.find(
      (
        p,
      ): p is DynamicToolUIPart & {
        state: "output-available";
        toolName: "saveChapterContent";
        output: { status: string; chapterIndex: number; sectionIndex: number };
      } =>
        p.type === "dynamic-tool" &&
        p.state === "output-available" &&
        p.toolName === "saveChapterContent",
    );

    if (toolCall) {
      const { chapterIndex, sectionIndex } = toolCall.output;

      console.log(`[Stream Update] 新章节已保存: Chapter ${chapterIndex}-${sectionIndex}`);

      // 重新从数据库加载所有章节
      loadChapters();
    }
  }, [generationMessages, loadChapters]);

  // 聊天用的 useChat（右边 Chat）
  const {
    messages: chatMessages,
    sendMessage: chatSend,
    status: chatStatus,
  } = useChat<ChatAgentMessage>({
    id: `course-chat-${courseId}`,
  });

  const isChatLoading = chatStatus === "streaming" || chatStatus === "submitted";

  // 提取当前章节正在生成的思考过程
  const currentThinking = useMemo(() => {
    if (generationStatus !== "streaming" && generationStatus !== "submitted") return null;
    const lastMessage = generationMessages[generationMessages.length - 1];
    // @ts-expect-error - reasoning is added by extractReasoningMiddleware
    return lastMessage?.reasoning || null;
  }, [generationMessages, generationStatus]);

  // 按需生成驱动逻辑 (On-Demand Generation)
  // 当用户选中的章节不存在时，触发生成
  useEffect(() => {
    if (generationStatus !== "ready") return;

    // 检查当前选中的章节是否已生成
    const chapterToGenerate: CourseChapterDTO | undefined = chapters.find(
      (c) => c.id === currentChapterId,
    );

    // 如果未生成且没有正在生成，则触发当前章节的生成
    if (
      chapterToGenerate &&
      currentChapterId &&
      !generatingChapterRef.current.has(currentChapterId)
    ) {
      console.log(`[On-Demand] Triggering generation for Chapter ${currentChapterId}...`);

      // 标记为正在生成
      generatingChapterRef.current.add(currentChapterId);

      // 保存 chapterId 到闭包中
      const chapterIdToGenerate = currentChapterId;

      generateChapter(
        {
          text: `请生成第 ${chapterToGenerate.chapterIndex + 1} 章的内容。`,
        },
        {
          body: {
            explicitIntent: "COURSE_GENERATION",
            courseGenerationContext: {
              id: courseId,
              userId: courseProfile.userId,
              goal: courseProfile.goal,
              background: courseProfile.background,
              targetOutcome: courseProfile.targetOutcome,
              cognitiveStyle: courseProfile.cognitiveStyle,
              outlineTitle: courseProfile.title,
              outlineData: outline,
              moduleCount: outline.modules?.length || 0,
              totalChapters: totalChapters,
              currentChapterIndex: chapterToGenerate.chapterIndex,
              chaptersGenerated: chapters.length,
            },
          },
        },
      );

      // 设置超时清理（防止永久锁定）
      const timeoutId = setTimeout(() => {
        if (chapterIdToGenerate) {
          generatingChapterRef.current.delete(chapterIdToGenerate);
        }
      }, 60000); // 60秒后清理锁定

      return () => clearTimeout(timeoutId);
    }
  }, [
    courseId,
    currentChapterId,
    chapters,
    generationStatus,
    totalChapters,
    courseProfile,
    generateChapter,
    outline,
  ]);

  // 获取章节全局索引的辅助函数
  const getGlobalChapterIndex = useCallback(
    (mIdx: number, cIdx: number) => {
      return (
        (outline.modules || []).slice(0, mIdx).reduce((sum, m) => sum + m.chapters.length, 0) + cIdx
      );
    },
    [outline],
  );

  const currentChapter: CourseChapterDTO | undefined = useMemo(
    () => chapters.find((c) => c.id === currentChapterId),
    [chapters, currentChapterId],
  );

  const currentChapterIndex = useMemo(() => {
    if (!currentChapterId) return 0;
    const chapter = chapters.find((c) => c.id === currentChapterId);
    return chapter?.chapterIndex ?? 0;
  }, [currentChapterId, chapters]);

  // 渲染工具输出结果 UI
  const renderToolOutput = (toolName: string, output: unknown, _toolCallId: string) => {
    if (!output) return null;

    switch (toolName) {
      case "quiz": {
        const res = output as QuizOutput;
        if (res.success && res.quiz) {
          const quiz = res.quiz;
          // 如果工具已经返回了题目，直接渲染 QuizResult
          if (quiz.questions && quiz.questions.length > 0) {
            return (
              <QuizResult
                topic={quiz.topic}
                difficulty={quiz.difficulty}
                questions={quiz.questions}
              />
            );
          }
          // 否则渲染一个提示卡片
          return (
            <div className="p-3 bg-violet-50 dark:bg-violet-950/30 rounded-xl border border-violet-200 dark:border-violet-800">
              <p className="text-xs font-medium text-violet-700 dark:text-violet-300">
                📝 生成测验：{quiz.topic}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">
                难度：
                {quiz.difficulty === "easy" ? "简单" : quiz.difficulty === "hard" ? "困难" : "中等"}
              </p>
            </div>
          );
        }
        break;
      }

      case "mindMap": {
        const res = output as MindMapOutput;
        if (res.success && res.mindMap) {
          const mm = res.mindMap;
          if (mm.nodes && mm.nodes.length > 0) {
            return (
              <div className="h-[400px] w-full">
                <MindMapView topic={mm.topic} nodes={mm.nodes} layout={mm.layout} />
              </div>
            );
          }
          return (
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-xl border border-indigo-200 dark:border-indigo-800">
              <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300">
                🧠 思维导图：{mm.topic}
              </p>
            </div>
          );
        }
        break;
      }

      case "summarize": {
        const res = output as SummarizeOutput;
        if (res.success && res.summary) {
          const s = res.summary;
          return (
            <SummaryResult
              content={s.content || ""}
              sourceLength={s.sourceLength || 0}
              style={s.style || "bullet_points"}
              length={s.length || "medium"}
            />
          );
        }
        break;
      }

      case "searchWeb": {
        const res = output as WebSearchOutput;
        if (res.success) {
          return (
            <WebSearchResult
              query={res.query}
              answer={res.answer}
              results={res.results || []}
              searchDepth={res.searchDepth || "basic"}
            />
          );
        }
        break;
      }
    }
    return null;
  };

  // 2026 现代化组件：思考轨迹显示
  const ThinkingTrail = ({ thinking }: { thinking: string | null }) => {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-12 p-8 bg-gradient-to-br from-black/[0.03] to-transparent border border-black/[0.05] rounded-[2.5rem] relative overflow-hidden group backdrop-blur-md"
      >
        {/* 动态流动背景 */}
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <motion.div
            animate={{
              background: [
                "radial-gradient(circle at 20% 20%, rgba(0,0,0,0.1) 0%, transparent 40%)",
                "radial-gradient(circle at 80% 80%, rgba(0,0,0,0.1) 0%, transparent 40%)",
                "radial-gradient(circle at 20% 20%, rgba(0,0,0,0.1) 0%, transparent 40%)",
              ],
            }}
            transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
            className="w-full h-full"
          />
        </div>

        <div className="flex items-center justify-between mb-8 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-2xl bg-black flex items-center justify-center shadow-xl shadow-black/10 transform group-hover:rotate-12 transition-transform duration-500">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-black/80 block leading-none mb-1.5">
                Cognitive Matrix
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-black/20 uppercase tracking-widest block">
                  Fluid Engine 2026
                </span>
                <div className="w-1 h-1 rounded-full bg-black/10" />
                <span className="text-[10px] font-bold text-black/40 uppercase tracking-widest block">
                  Processing...
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 pl-2 border-l-2 border-black/5 ml-4">
          {thinking ? (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-lg text-black/80 italic leading-relaxed font-medium font-serif"
            >
              {thinking}
            </motion.p>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="h-5 bg-black/5 rounded-full w-[85%] animate-pulse" />
              <div className="h-5 bg-black/5 rounded-full w-[60%] animate-pulse" />
            </div>
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-[#FDFDFD] relative overflow-hidden font-sans selection:bg-black/10 selection:text-black flex flex-col">
      {/* Organic Noise Texture */}
      <div
        className="absolute inset-0 z-0 opacity-[0.02] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      <OrganicHeader />

      <div className="flex-1 flex relative z-10 pt-16 overflow-hidden">
        {/* Left Sidebar: Navigation */}
        <AnimatePresence mode="wait">
          {isSidebarOpen && (
            <motion.aside
              initial={{ x: -300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -300, opacity: 0 }}
              className="w-80 border-r border-black/[0.04] bg-white/40 backdrop-blur-2xl flex flex-col z-30"
            >
              <div className="p-8 border-b border-black/[0.04]">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-[10px] font-black text-black/30 uppercase tracking-[0.2em]">
                    Course Syllabus
                  </h2>
                  <div className="px-2 py-0.5 rounded bg-black/5 text-[10px] font-bold text-black/40">
                    2026 EDITION
                  </div>
                </div>

                <h3 className="text-xl font-black text-black leading-tight mb-6">
                  {courseProfile.title}
                </h3>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest mb-1">
                    <span className="text-black">Overall Progress</span>
                    <span className="text-black/40">
                      {Math.round((chapters.length / totalChapters) * 100)}%
                    </span>
                  </div>
                  <div className="h-1 bg-black/5 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-black"
                      initial={{ width: 0 }}
                      animate={{
                        width: `${(chapters.length / totalChapters) * 100}%`,
                      }}
                      transition={{ duration: 1, ease: "circOut" }}
                    />
                  </div>
                </div>
              </div>

              <nav className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {outline.modules?.map((module, mIdx) => (
                  <div key={mIdx} className="mb-10 last:mb-0">
                    <div className="px-4 mb-4 flex items-center gap-3">
                      <span className="text-[10px] font-black text-black uppercase tracking-[0.2em]">
                        {String(mIdx + 1).padStart(2, "0")}
                      </span>
                      <h4 className="text-[10px] font-black text-black/20 uppercase tracking-[0.1em] truncate">
                        {module.title}
                      </h4>
                    </div>

                    <div className="space-y-1">
                      {module.chapters.map((chapter, cIdx) => {
                        // 使用优化的辅助函数计算全局索引
                        const globalIdx = getGlobalChapterIndex(mIdx, cIdx);

                        // 找到对应的已生成章节（如果存在）
                        const generatedChapter = chapters.find((c) => c.chapterIndex === globalIdx);
                        const isGenerated = !!generatedChapter;
                        const isActive = currentChapterId === generatedChapter?.id;
                        const isGenerating = generatedChapter
                          ? generatingChapterRef.current.has(generatedChapter.id)
                          : false;

                        return (
                          <button
                            key={cIdx}
                            onClick={() => {
                              if (generatedChapter) {
                                setCurrentChapterId(generatedChapter.id);
                              }
                            }}
                            className={`w-full group flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-500 relative ${
                              isActive
                                ? "bg-black text-white shadow-2xl shadow-black/20 translate-x-1"
                                : isGenerating
                                  ? "bg-violet-50 text-violet-700 animate-pulse"
                                  : isGenerated
                                    ? "hover:bg-black/[0.03] text-black/60 hover:text-black"
                                    : "hover:bg-violet-50 text-neutral-400 hover:text-violet-700"
                            }`}
                          >
                            <div className="relative flex-shrink-0">
                              {isGenerating ? (
                                <div className="w-2 h-2 rounded-full bg-violet-500 animate-ping" />
                              ) : isGenerated ? (
                                <div
                                  className={`w-2 h-2 rounded-full ${isActive ? "bg-white" : "bg-black/20 group-hover:bg-black"}`}
                                />
                              ) : (
                                <div className="w-2 h-2 rounded-full border-2 border-dashed border-neutral-300 group-hover:border-violet-400" />
                              )}
                            </div>

                            <div className="flex-1 text-left min-w-0">
                              <div className="text-sm font-bold truncate">{chapter.title}</div>
                              {!isGenerated && !isGenerating && (
                                <div className="text-[10px] opacity-70 group-hover:opacity-100">
                                  点击生成
                                </div>
                              )}
                            </div>

                            {isActive && (
                              <motion.div
                                layoutId="active-indicator"
                                className="absolute left-0 w-1 h-4 bg-white rounded-full -translate-x-0.5"
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </nav>

              <div className="p-6 mt-auto">
                <button
                  onClick={() => router.push("/create")}
                  className="flex items-center justify-center gap-3 w-full py-4 rounded-2xl bg-black/5 hover:bg-black text-black/40 hover:text-white text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-500 group"
                >
                  <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                  Exit To Lab
                </button>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col relative overflow-hidden bg-white">
          {/* Content Header */}
          <header className="h-16 border-b border-black/[0.04] flex items-center justify-between px-8 bg-white/80 backdrop-blur-md sticky top-0 z-20">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="p-2 rounded-lg hover:bg-black/5 text-black/40 hover:text-black transition-colors"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="h-4 w-px bg-black/10 mx-2" />
              <div className="flex flex-col">
                <div className="text-[10px] font-bold text-black/30 uppercase tracking-widest leading-none mb-1">
                  正在学习
                </div>
                <h1 className="text-sm font-bold text-black truncate max-w-[400px]">
                  {currentChapter?.title || "等待内容生成..."}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsChatOpen(!isChatOpen)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all ${
                  isChatOpen
                    ? "bg-black text-white shadow-lg shadow-black/10"
                    : "bg-black/5 text-black/60 hover:bg-black/10"
                }`}
              >
                <Sparkles className={`w-3.5 h-3.5 ${isChatOpen ? "animate-pulse" : ""}`} />
                智能助手
              </button>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar bg-[#F9F9F9]">
            <div className="mx-auto max-w-4xl px-12 py-20">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentChapterId || "empty"}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                  className="space-y-16"
                >
                  {!currentChapter ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <ThinkingTrail thinking={currentThinking} />
                      <div className="mt-8 space-y-2">
                        <h3 className="text-2xl font-black text-black tracking-tight">
                          正在为您编排知识...
                        </h3>
                        <p className="text-black/40 text-sm font-medium">
                          AI 正在构建第 {currentChapterIndex + 1} 章节的深度内容
                        </p>
                      </div>
                    </div>
                  ) : (
                    <article className="relative">
                      {/* 章节标题系统 */}
                      <div className="mb-20 space-y-8">
                        <div className="flex items-center gap-4">
                          <span className="px-3 py-1 rounded-full bg-black text-[10px] font-black text-white uppercase tracking-[0.2em]">
                            Chapter {currentChapter.chapterIndex + 1}
                          </span>
                          <div className="h-px flex-1 bg-black/5" />
                          <span className="text-[10px] font-bold text-black/30 uppercase tracking-widest">
                            {Math.round(currentChapter.contentMarkdown.length / 500)} min read
                          </span>
                        </div>

                        <h1 className="text-6xl font-black text-black tracking-tighter leading-[1.1]">
                          {currentChapter.title}
                        </h1>

                        <div className="flex items-center gap-6 pt-4">
                          <div className="flex -space-x-2">
                            {[0, 1, 2].map((i) => (
                              <div
                                key={i}
                                className="w-8 h-8 rounded-full border-2 border-white bg-black/5 overflow-hidden"
                              >
                                <img
                                  src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${i + 10}`}
                                  alt="avatar"
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            ))}
                          </div>
                          <div className="text-[10px] font-bold text-black/40 uppercase tracking-widest">
                            Jointly Synthesized by <span className="text-black">Nexus AI</span> &{" "}
                            <span className="text-black">You</span>
                          </div>
                        </div>
                      </div>

                      {/* 正文内容 - 2026 Fluid Typography */}
                      <ContentRenderer content={currentChapter.contentMarkdown} />

                      {/* 思考轨迹 (如果仍在生成中) */}
                      {isChatLoading && (
                        <div className="mt-16">
                          <ThinkingTrail thinking={currentThinking} />
                        </div>
                      )}

                      {/* 章节导航 - 极简主义设计 */}
                      <div className="mt-32 pt-16 border-t border-black/[0.05] flex items-center justify-between">
                        <button
                          onClick={() => {
                            if (currentChapter) {
                              const prevChapter = chapters.find(
                                (c) => c.chapterIndex === currentChapter.chapterIndex - 1,
                              );
                              if (prevChapter) {
                                setCurrentChapterId(prevChapter.id);
                              }
                            }
                          }}
                          disabled={!currentChapter || currentChapter.chapterIndex === 0}
                          className="group flex items-center gap-6 disabled:opacity-20"
                        >
                          <div className="w-14 h-14 rounded-full border border-black/10 flex items-center justify-center group-hover:bg-black group-hover:text-white transition-all duration-500">
                            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                          </div>
                          <div className="text-left">
                            <div className="text-[10px] font-black uppercase tracking-widest text-black/30">
                              Previous
                            </div>
                            <div className="text-lg font-bold text-black">上一章节</div>
                          </div>
                        </button>

                        <div className="hidden md:flex flex-col items-center">
                          <div className="text-[10px] font-black text-black/20 uppercase tracking-[0.3em] mb-2">
                            Progress
                          </div>
                          <div className="flex gap-1">
                            {Array.from({ length: totalChapters }).map((_, i) => (
                              <div
                                key={i}
                                className={`w-1.5 h-1.5 rounded-full transition-all duration-500 ${
                                  i === currentChapterIndex
                                    ? "w-6 bg-black"
                                    : i < chapters.length
                                      ? "bg-black/20"
                                      : "bg-black/5"
                                }`}
                              />
                            ))}
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            if (currentChapter) {
                              const nextChapter = chapters.find(
                                (c) => c.chapterIndex === currentChapter.chapterIndex + 1,
                              );
                              if (nextChapter) {
                                setCurrentChapterId(nextChapter.id);
                              }
                            }
                          }}
                          disabled={
                            !currentChapter ||
                            !chapters.some((c) => c.chapterIndex === currentChapterIndex + 1)
                          }
                          className="group flex items-center gap-6 text-right disabled:opacity-20"
                        >
                          <div className="text-right">
                            <div className="text-[10px] font-black uppercase tracking-widest text-black/30">
                              Next
                            </div>
                            <div className="text-lg font-bold text-black">下一章节</div>
                          </div>
                          <div className="w-14 h-14 rounded-full bg-black text-white flex items-center justify-center shadow-2xl shadow-black/20 group-hover:scale-110 transition-all duration-500">
                            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                          </div>
                        </button>
                      </div>
                    </article>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </main>

        {/* Right Sidebar: Chat */}
        <AnimatePresence>
          {isChatOpen && (
            <motion.aside
              initial={{ x: 400, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 400, opacity: 0 }}
              className="w-96 border-l border-black/[0.06] bg-white/50 backdrop-blur-xl flex flex-col"
            >
              <div className="p-6 border-b border-black/[0.04] flex items-center justify-between">
                <h2 className="text-sm font-bold text-black flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-black/40" />
                  智能辅助
                </h2>
                <button
                  onClick={() => setIsChatOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-black/5 text-black/20 hover:text-black transition-colors"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 flex flex-col min-h-0">
                <UnifiedChatUI
                  messages={chatMessages}
                  isLoading={isChatLoading}
                  input=""
                  onInputChange={() => {}}
                  onStop={() => {}}
                  renderToolOutput={renderToolOutput}
                  onSubmit={(e) => {
                    e.preventDefault();
                    chatSend(
                      {
                        text: "根据当前内容帮我总结一下",
                      },
                      {
                        body: {
                          explicitIntent: "CHAT",
                        },
                      },
                    );
                  }}
                  variant="chat"
                  placeholder="针对当前章节提问..."
                  renderMessage={(message, _text, isUser) => {
                    const content = getMessageContent(message);
                    if (isUser) {
                      return (
                        <div className="flex justify-end px-4">
                          <div className="bg-violet-600 px-5 py-3 rounded-2xl rounded-tr-sm shadow-lg shadow-violet-600/10">
                            <p className="text-sm font-medium text-white">{content}</p>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div className="flex justify-start px-4">
                        <div className="bg-white dark:bg-neutral-800 border border-black/5 dark:border-white/5 px-6 py-4 rounded-2xl rounded-tl-sm shadow-sm max-w-[90%]">
                          <MessageResponse
                            className="text-sm leading-relaxed text-neutral-800 dark:text-neutral-200"
                            mode={
                              isChatLoading &&
                              message.id === chatMessages[chatMessages.length - 1].id
                                ? "streaming"
                                : "static"
                            }
                          >
                            {content}
                          </MessageResponse>
                        </div>
                      </div>
                    );
                  }}
                  renderEmpty={() => (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
                      <div className="w-12 h-12 rounded-2xl bg-black/5 flex items-center justify-center">
                        <MessageSquare className="w-6 h-6 text-black/20" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-black">有什么疑问吗？</p>
                        <p className="text-xs text-black/40 leading-relaxed">
                          AI 随时为您解答当前章节的难点，或者帮您生成练习题。
                        </p>
                      </div>
                      <div className="grid grid-cols-1 gap-2 w-full pt-4">
                        {["核心要点总结", "帮我出几道题", "深入解释一下"].map((q) => (
                          <button
                            key={q}
                            className="text-left px-4 py-2.5 rounded-xl bg-black/5 hover:bg-black text-black/60 hover:text-white text-[11px] font-bold transition-all"
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                />
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
