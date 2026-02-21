"use client";

import { useChat } from "@ai-sdk/react";
import type { DynamicToolUIPart } from "ai";
import { AnimatePresence, motion, type PanInfo, useMotionValue } from "framer-motion";
import { ArrowLeft, ArrowRight, ChevronLeft, Menu, MessageSquare, Sparkles, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChatAgentMessage } from "@/features/chat/agents/chat-agent";
import { MessageResponse } from "@/features/chat/components/ai/Message";
import { UnifiedChatUI } from "@/features/chat/components/ai/UnifiedChatUI";
import {
  MindMapView,
  QuizResult,
  SummaryResult,
  WebSearchResult,
} from "@/features/chat/components/ai/ui";
import {
  getCourseChaptersAction,
  updateCourseProgressAction,
} from "@/features/learning/actions/course";
import type { CourseGenerationAgentMessage } from "@/features/learning/agents/course-generation/agent";
import { ContentRenderer } from "@/features/learning/components/course/content-renderer";
import { OrganicHeader } from "@/features/learning/components/create/OrganicHeader";
import type {
  MindMapOutput,
  QuizOutput,
  SummarizeOutput,
  WebSearchOutput,
} from "@/features/learning/tools/types";
import type { OutlineData } from "@/features/shared/ai/types/course";
import { getMessageContent } from "@/features/shared/ai/ui-utils";
import { cn } from "@/features/shared/utils";
import type { CourseChapterDTO, CourseProfileDTO } from "@/lib/actions/types";

interface LearnPageClientProps {
  courseId: string;
  initialProfile: CourseProfileDTO;
}

export default function LearnPageClient({ courseId, initialProfile }: LearnPageClientProps) {
  const [courseProfile] = useState<CourseProfileDTO>(initialProfile);
  const _router = useRouter();
  const searchParams = useSearchParams();
  const [currentChapterId, setCurrentChapterId] = useState<string | null>(null);
  const [chapters, setChapters] = useState<CourseChapterDTO[]>([]);
  const [_isGenerationComplete, _setIsGenerationComplete] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);

  const leftSidebarX = useMotionValue(0);
  const rightSidebarX = useMotionValue(0);

  const handleLeftDragEnd = (_: any, info: PanInfo) => {
    const threshold = 100;
    if (info.offset.x < -threshold) {
      setIsSidebarOpen(false);
    } else {
      leftSidebarX.set(0);
    }
  };

  const handleRightDragEnd = (_: any, info: PanInfo) => {
    const threshold = 100;
    if (info.offset.x > threshold) {
      setIsChatOpen(false);
    } else {
      rightSidebarX.set(0);
    }
  };

  const closeLeftSidebar = () => {
    setIsSidebarOpen(false);
    leftSidebarX.set(0);
  };

  const closeRightSidebar = () => {
    setIsChatOpen(false);
    rightSidebarX.set(0);
  };

  const generatingChapterRef = useRef<Set<string>>(new Set());
  const _generationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [_isInitialLoading, setIsInitialLoading] = useState(true);

  const {
    messages: generationMessages,
    sendMessage: generateChapter,
    status: generationStatus,
  } = useChat<CourseGenerationAgentMessage>({
    id: `course-generation-${courseId}`,
  });

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

  useEffect(() => {
    loadChapters();
  }, [loadChapters]);

  useEffect(() => {
    const chapterIdFromUrl = searchParams.get("chapterId");
    if (chapters.length > 0) {
      if (chapterIdFromUrl) {
        const chapter = chapters.find((c) => c.id === chapterIdFromUrl);
        if (chapter) {
          setCurrentChapterId(chapter.id);
        }
      } else if (!currentChapterId) {
        const firstGenerated = [...chapters].sort((a, b) => a.chapterIndex - b.chapterIndex)[0];
        if (firstGenerated) {
          setCurrentChapterId(firstGenerated.id);
        }
      }
    }
  }, [chapters, searchParams, currentChapterId]);

  useEffect(() => {
    const currentChapter = chapters.find((c) => c.id === currentChapterId);
    if (currentChapter?.id) {
      const newUrl = `${window.location.pathname}?chapterId=${currentChapter.id}`;
      window.history.replaceState({ ...window.history.state, as: newUrl, url: newUrl }, "", newUrl);
    }
  }, [currentChapterId, chapters]);

  const outline = useMemo(
    () => courseProfile.outlineData as OutlineData,
    [courseProfile.outlineData],
  );

  const totalChapters = useMemo(() => {
    return (
      outline?.modules
        ?.map((m) => m.chapters.length)
        .reduce((sum: number, len: number) => sum + len, 0) || 0
    );
  }, [outline]);

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
      loadChapters();
    }
  }, [generationMessages, loadChapters]);

  const {
    messages: chatMessages,
    sendMessage: chatSend,
    status: chatStatus,
  } = useChat<ChatAgentMessage>({
    id: `course-chat-${courseId}`,
  });

  const isChatLoading = chatStatus === "streaming" || chatStatus === "submitted";

  const currentThinking = useMemo(() => {
    if (generationStatus !== "streaming" && generationStatus !== "submitted") return null;
    const lastMessage = generationMessages[generationMessages.length - 1];
    return (lastMessage as any)?.reasoning || null;
  }, [generationMessages, generationStatus]);

  useEffect(() => {
    if (generationStatus !== "ready") return;

    const chapterToGenerate: CourseChapterDTO | undefined = chapters.find(
      (c) => c.id === currentChapterId,
    );

    if (
      chapterToGenerate &&
      currentChapterId &&
      !generatingChapterRef.current.has(currentChapterId)
    ) {
      console.log(`[On-Demand] Triggering generation for Chapter ${currentChapterId}...`);

      generatingChapterRef.current.add(currentChapterId);

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
              interviewProfile: courseProfile.interviewProfile,
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

      const timeoutId = setTimeout(() => {
        if (chapterIdToGenerate) {
          generatingChapterRef.current.delete(chapterIdToGenerate);
        }
      }, 60000);

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

  const renderToolOutput = (toolName: string, output: unknown, _toolCallId: string) => {
    if (!output) return null;

    switch (toolName) {
      case "quiz": {
        const res = output as QuizOutput;
        if (res.success && res.quiz) {
          const quiz = res.quiz;
          if (quiz.questions && quiz.questions.length > 0) {
            return (
              <QuizResult
                topic={quiz.topic}
                difficulty={quiz.difficulty}
                questions={quiz.questions}
              />
            );
          }
          return (
            <div className="p-3 bg-primary/10 rounded-xl border border-primary/20">
              <p className="text-xs font-medium text-primary">📝 生成测验：{quiz.topic}</p>
              <p className="text-[10px] text-foreground/60 mt-1">
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
            <div className="p-3 bg-primary/10 rounded-xl border border-primary/20">
              <p className="text-xs font-medium text-primary">🧠 思维导图：{mm.topic}</p>
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

  const ThinkingTrail = ({ thinking }: { thinking: string | null }) => {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 md:mb-12 p-6 md:p-8 bg-gradient-to-br from-primary/5 to-transparent border border-black/5 rounded-2xl md:rounded-[2.5rem] relative overflow-hidden group backdrop-blur-md"
      >
        <div className="flex items-center gap-3 md:gap-4 mb-6 md:mb-8 relative z-10">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
            <Sparkles className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-foreground/60 block leading-none mb-1">
              认知矩阵
            </span>
            <span className="text-[10px] font-bold text-foreground/30 uppercase tracking-widest block">
              正在处理...
            </span>
          </div>
        </div>

        <div className="relative z-10 pl-2 border-l-2 border-black/5 ml-4">
          {thinking ? (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-base md:text-lg text-foreground/80 italic leading-relaxed font-medium font-serif"
            >
              {thinking}
            </motion.p>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="h-5 bg-foreground/5 rounded-full w-[85%] animate-pulse" />
              <div className="h-5 bg-foreground/5 rounded-full w-[60%] animate-pulse" />
            </div>
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden font-sans selection:bg-primary/10 selection:text-foreground flex flex-col">
      <div
        className="absolute inset-0 z-0 opacity-[0.02] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      <OrganicHeader />

      <div className="flex-1 flex relative z-10 pt-16 overflow-hidden">
        <LeftDrawer
          isOpen={isSidebarOpen}
          onClose={closeLeftSidebar}
          courseProfile={courseProfile}
          chapters={chapters}
          totalChapters={totalChapters}
          currentChapterId={currentChapterId}
          setCurrentChapterId={setCurrentChapterId}
          outline={outline}
          getGlobalChapterIndex={getGlobalChapterIndex}
          generatingChapterRef={generatingChapterRef}
          dragX={leftSidebarX}
          onDragEnd={handleLeftDragEnd}
        />

        <main className="flex-1 flex flex-col relative overflow-hidden bg-background">
          <CourseHeader
            currentChapter={currentChapter}
            currentChapterIndex={currentChapterIndex}
            isSidebarOpen={isSidebarOpen}
            isChatOpen={isChatOpen}
            onMenuClick={() => setIsSidebarOpen(true)}
            onChatClick={() => setIsChatOpen(true)}
          />

          <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar bg-surface-50/30">
            <div className="mx-auto max-w-4xl px-6 md:px-12 py-16 md:py-20 pb-safe-bottom">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentChapterId || "empty"}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                  className="space-y-12 md:space-y-16"
                >
                  {!currentChapter ? (
                    <div className="flex flex-col items-center justify-center py-12 md:py-20 text-center">
                      <ThinkingTrail thinking={currentThinking} />
                      <div className="mt-6 md:mt-8 space-y-2">
                        <h3 className="text-xl md:text-2xl font-black text-foreground tracking-tight">
                          正在为您编排知识...
                        </h3>
                        <p className="text-foreground/40 text-sm font-medium">
                          AI 正在构建第 {currentChapterIndex + 1} 章节的深度内容
                        </p>
                      </div>
                    </div>
                  ) : (
                    <article className="relative">
                      <div className="mb-12 md:mb-20 space-y-6 md:space-y-8">
                        <div className="flex items-center gap-3 md:gap-4">
                          <span className="px-3 py-1 rounded-full bg-primary text-[10px] font-black text-primary-foreground uppercase tracking-[0.2em]">
                            Chapter {currentChapter.chapterIndex + 1}
                          </span>
                          <div className="h-px flex-1 bg-black/5" />
                          <span className="text-[10px] font-bold text-foreground/30 uppercase tracking-widest">
                            {Math.round(currentChapter.contentMarkdown.length / 500)} min read
                          </span>
                        </div>

                        <h1 className="text-4xl md:text-6xl font-black text-foreground tracking-tighter leading-[1.1]">
                          {currentChapter.title}
                        </h1>

                        <div className="flex items-center gap-4 md:gap-6 pt-4">
                          <div className="flex -space-x-2">
                            {[0, 1, 2].map((i) => (
                              <div
                                key={i}
                                className="w-8 h-8 rounded-full border-2 border-background bg-foreground/5 overflow-hidden"
                              >
                                <img
                                  src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${i + 10}`}
                                  alt="avatar"
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            ))}
                          </div>
                          <div className="text-[10px] font-bold text-foreground/40 uppercase tracking-widest">
                            由 <span className="text-foreground">Nexus AI</span> 与{" "}
                            <span className="text-foreground">您</span> 共同生成
                          </div>
                        </div>
                      </div>

                      <ContentRenderer content={currentChapter.contentMarkdown} />

                      {isChatLoading && (
                        <div className="mt-12 md:mt-16">
                          <ThinkingTrail thinking={currentThinking} />
                        </div>
                      )}

                      <ChapterNavigation
                        currentChapter={currentChapter}
                        chapters={chapters}
                        totalChapters={totalChapters}
                        currentChapterIndex={currentChapterIndex}
                        setCurrentChapterId={setCurrentChapterId}
                      />
                    </article>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </main>

        <RightDrawer
          isOpen={isChatOpen}
          onClose={closeRightSidebar}
          chatMessages={chatMessages}
          isChatLoading={isChatLoading}
          chatSend={chatSend}
          renderToolOutput={renderToolOutput}
          dragX={rightSidebarX}
          onDragEnd={handleRightDragEnd}
        />
      </div>
    </div>
  );
}

function LeftDrawer({
  isOpen,
  onClose,
  courseProfile,
  chapters,
  totalChapters,
  currentChapterId,
  setCurrentChapterId,
  outline,
  getGlobalChapterIndex,
  generatingChapterRef,
  dragX,
  onDragEnd,
}: any) {
  return (
    <>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm md:hidden"
          onClick={onClose}
        />
      )}
      <motion.aside
        drag="x"
        dragConstraints={{ left: -320, right: 0 }}
        dragElastic={0.1}
        dragMomentum={false}
        style={{ x: dragX }}
        onDragEnd={onDragEnd}
        initial={isOpen ? false : { x: -320 }}
        animate={{ x: isOpen ? 0 : -320 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className={cn(
          "fixed left-0 top-0 bottom-0 z-50 bg-surface-50/95 backdrop-blur-xl border-r border-black/5 shadow-glass flex flex-col",
          "hidden md:flex md:static md:shadow-none md:backdrop-blur-none md:w-80",
        )}
      >
        <div className="p-4 md:p-8 border-b border-black/5 flex items-center justify-between">
          <h2 className="text-xs font-black text-foreground/30 uppercase tracking-[0.2em] hidden md:block">
            课程大纲
          </h2>
          <h3 className="text-sm font-bold text-foreground truncate flex-1 md:hidden">
            {courseProfile.title}
          </h3>
          <button
            onClick={onClose}
            className="md:hidden p-2 rounded-lg hover:bg-black/5 text-foreground/60"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 md:p-8 border-b border-black/5 hidden md:block">
          <h3 className="text-xl font-black text-foreground leading-tight mb-6">
            {courseProfile.title}
          </h3>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest mb-1">
              <span className="text-foreground">整体进度</span>
              <span className="text-foreground/40">
                {Math.round((chapters.length / totalChapters) * 100)}%
              </span>
            </div>
            <div className="h-1 bg-black/5 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-primary"
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
          {outline.modules?.map(
            (
              module: { title: string; chapters: { title: string; contentSnippet?: string }[] },
              mIdx: number,
            ) => (
              <div key={mIdx} className="mb-6 md:mb-10 last:mb-0">
                <div className="px-4 mb-3 md:mb-4 flex items-center gap-3">
                  <span className="text-[10px] font-black text-foreground uppercase tracking-[0.2em]">
                    {String(mIdx + 1).padStart(2, "0")}
                  </span>
                  <h4 className="text-[10px] font-black text-foreground/20 uppercase tracking-[0.1em] truncate">
                    {module.title}
                  </h4>
                </div>

                <div className="space-y-1">
                  {module.chapters.map(
                    (chapter: { title: string; contentSnippet?: string }, cIdx: number) => {
                      const globalIdx = getGlobalChapterIndex(mIdx, cIdx);
                      const generatedChapter = chapters.find(
                        (c: CourseChapterDTO) => c.chapterIndex === globalIdx,
                      );
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
                          className={`w-full group flex items-center gap-3 md:gap-4 px-3 md:px-4 py-2.5 md:py-3 rounded-xl md:rounded-2xl transition-all duration-500 relative touch-safe ${
                            isActive
                              ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                              : isGenerating
                                ? "bg-primary/10 text-primary animate-pulse"
                                : isGenerated
                                  ? "hover:bg-black/5 text-foreground/70 hover:text-foreground"
                                  : "hover:bg-primary/10 text-foreground/40 hover:text-primary"
                          }`}
                        >
                          <div className="relative flex-shrink-0">
                            {isGenerating ? (
                              <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-primary animate-ping" />
                            ) : isGenerated ? (
                              <div
                                className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${isActive ? "bg-primary-foreground" : "bg-foreground/20 group-hover:bg-foreground"}`}
                              />
                            ) : (
                              <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full border-2 border-dashed border-foreground/20 group-hover:border-primary" />
                            )}
                          </div>

                          <div className="flex-1 text-left min-w-0">
                            <div className="text-xs md:text-sm font-bold truncate">
                              {chapter.title}
                            </div>
                            {!isGenerated && !isGenerating && (
                              <div className="text-[10px] opacity-70 group-hover:opacity-100">
                                点击生成
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    },
                  )}
                </div>
              </div>
            ),
          )}
        </nav>

        <div className="p-4 md:p-6 mt-auto border-t border-black/5 hidden md:block">
          <button
            onClick={() => (window.location.href = "/create")}
            className="flex items-center justify-center gap-3 w-full py-4 rounded-xl bg-black/5 hover:bg-black text-foreground/40 hover:text-white text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-500 group"
          >
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            返回创建页面
          </button>
        </div>
      </motion.aside>
    </>
  );
}

function CourseHeader({
  currentChapter,
  currentChapterIndex,
  isSidebarOpen,
  isChatOpen,
  onMenuClick,
  onChatClick,
}: any) {
  return (
    <header className="h-14 md:h-16 border-b border-black/5 flex items-center justify-between px-4 md:px-8 bg-background/80 backdrop-blur-md sticky top-0 z-20">
      <div className="flex items-center gap-2 md:gap-4">
        <button
          onClick={onMenuClick}
          className="p-2 rounded-lg hover:bg-black/5 text-foreground/40 hover:text-foreground transition-colors touch-safe"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="h-4 w-px bg-black/10 mx-1 md:mx-2" />
        <div className="flex flex-col min-w-0">
          <div className="text-[10px] font-bold text-foreground/30 uppercase tracking-widest leading-none mb-0.5">
            正在学习
          </div>
          <h1 className="text-xs md:text-sm font-bold text-foreground truncate max-w-[200px] md:max-w-[400px]">
            {currentChapter?.title || "等待内容生成..."}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        <button
          onClick={onChatClick}
          className={`flex items-center gap-2 md:gap-2.5 px-3 md:px-4 py-2 rounded-full text-xs font-bold transition-all touch-safe ${
            isChatOpen
              ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
              : "bg-black/5 text-foreground/60 hover:bg-black/10 hover:text-foreground"
          }`}
        >
          <Sparkles className={`w-3.5 h-3.5 ${isChatOpen ? "animate-pulse" : ""}`} />
          <span className="hidden md:inline">智能助手</span>
        </button>
      </div>
    </header>
  );
}

function RightDrawer({
  isOpen,
  onClose,
  chatMessages,
  isChatLoading,
  chatSend,
  renderToolOutput,
  dragX,
  onDragEnd,
}: any) {
  return (
    <>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm md:hidden"
          onClick={onClose}
        />
      )}
      <motion.aside
        drag="x"
        dragConstraints={{ left: 0, right: 384 }}
        dragElastic={0.1}
        dragMomentum={false}
        style={{ x: dragX }}
        onDragEnd={onDragEnd}
        initial={isOpen ? false : { x: 384 }}
        animate={{ x: isOpen ? 0 : 384 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className={cn(
          "fixed right-0 top-0 bottom-0 z-50 bg-surface-50/95 backdrop-blur-xl border-l border-black/5 shadow-glass flex flex-col",
          "hidden md:flex md:static md:shadow-none md:backdrop-blur-none md:w-96",
        )}
      >
        <div className="p-4 md:p-6 border-b border-black/5 flex items-center justify-between">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-foreground/40" />
            智能辅助
          </h2>
          <button
            onClick={onClose}
            className="md:hidden p-1.5 rounded-lg hover:bg-black/5 text-foreground/20 hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
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
            onSubmit={(e: any) => {
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
            renderMessage={(message: any, _text: string, isUser: boolean) => {
              const content = getMessageContent(message);
              if (isUser) {
                return (
                  <div className="flex justify-end px-4">
                    <div className="bg-primary px-4 md:px-5 py-3 rounded-2xl rounded-tr-sm shadow-lg shadow-primary/10">
                      <p className="text-sm font-medium text-primary-foreground">{content}</p>
                    </div>
                  </div>
                );
              }

              return (
                <div className="flex justify-start px-4">
                  <div className="bg-background border border-black/5 px-4 md:px-6 py-3 md:py-4 rounded-2xl rounded-tl-sm shadow-sm max-w-[90%]">
                    <MessageResponse
                      className="text-sm leading-relaxed text-foreground"
                      mode={
                        isChatLoading && message.id === chatMessages[chatMessages.length - 1].id
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
              <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-8 text-center space-y-4">
                <div className="w-10 md:w-12 h-10 md:h-12 rounded-xl bg-black/5 flex items-center justify-center">
                  <MessageSquare className="w-5 md:w-6 h-5 md:h-6 text-foreground/20" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-foreground">有什么疑问吗？</p>
                  <p className="text-xs text-foreground/40 leading-relaxed">
                    AI 随时为您解答当前章节的难点，或者帮您生成练习题。
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-2 w-full pt-4">
                  {["核心要点总结", "帮我出几道题", "深入解释一下"].map((q) => (
                    <button
                      key={q}
                      className="text-left px-4 py-2.5 rounded-xl bg-black/5 hover:bg-black text-foreground/60 hover:text-white text-xs font-bold transition-all touch-safe"
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
    </>
  );
}

function ChapterNavigation({
  currentChapter,
  chapters,
  totalChapters,
  currentChapterIndex,
  setCurrentChapterId,
}: any) {
  return (
    <div className="mt-16 md:mt-32 pt-8 md:pt-16 border-t border-black/5">
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={() => {
            if (currentChapter) {
              const prevChapter = chapters.find(
                (c: any) => c.chapterIndex === currentChapter.chapterIndex - 1,
              );
              if (prevChapter) {
                setCurrentChapterId(prevChapter.id);
              }
            }
          }}
          disabled={!currentChapter || currentChapter.chapterIndex === 0}
          className="group flex items-center gap-3 md:gap-6 disabled:opacity-20 flex-1 justify-start"
        >
          <div className="w-10 h-10 md:w-14 md:h-14 rounded-full border border-black/10 flex items-center justify-center group-hover:bg-foreground group-hover:text-background transition-all duration-500">
            <ArrowLeft className="w-4 md:w-5 h-4 md:h-5 group-hover:-translate-x-1 transition-transform" />
          </div>
          <div className="text-left hidden sm:block">
            <div className="text-[10px] font-black uppercase tracking-widest text-foreground/30">
              Previous
            </div>
            <div className="text-sm md:text-lg font-bold text-foreground">上一章节</div>
          </div>
        </button>

        <div className="hidden md:flex flex-col items-center px-4">
          <div className="text-[10px] font-black text-foreground/20 uppercase tracking-[0.3em] mb-2">
            Progress
          </div>
          <div className="flex gap-1">
            {Array.from({ length: totalChapters }).map((_, i) => (
              <div
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-all duration-500 ${
                  i === currentChapterIndex
                    ? "w-6 bg-primary"
                    : i < chapters.length
                      ? "bg-foreground/20"
                      : "bg-foreground/5"
                }`}
              />
            ))}
          </div>
        </div>

        <button
          onClick={() => {
            if (currentChapter) {
              const nextChapter = chapters.find(
                (c: any) => c.chapterIndex === currentChapter.chapterIndex + 1,
              );
              if (nextChapter) {
                setCurrentChapterId(nextChapter.id);
              }
            }
          }}
          disabled={
            !currentChapter ||
            !chapters.some((c: any) => c.chapterIndex === currentChapterIndex + 1)
          }
          className="group flex items-center gap-3 md:gap-6 text-right disabled:opacity-20 flex-1 justify-end"
        >
          <div className="text-right hidden sm:block">
            <div className="text-[10px] font-black uppercase tracking-widest text-foreground/30">
              Next
            </div>
            <div className="text-sm md:text-lg font-bold text-foreground">下一章节</div>
          </div>
          <div className="w-10 h-10 md:w-14 md:h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/20 group-hover:scale-110 transition-all duration-500">
            <ArrowRight className="w-4 md:w-5 h-4 md:h-5 group-hover:translate-x-1 transition-transform" />
          </div>
        </button>
      </div>
    </div>
  );
}
