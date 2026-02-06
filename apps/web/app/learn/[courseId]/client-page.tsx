"use client";

import { useEffect, useMemo, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { ReadOnlyOutlineEditor } from "@/components/create/ReadOnlyOutlineEditor";
import { UnifiedChatUI } from "@/components/ai/UnifiedChatUI";
import type { InterviewAgentMessage } from "@/lib/ai/agents/interview/agent";
import type { OutlineData } from "@/lib/ai/profile/course-profile";
import { ChevronLeft, Zap } from "lucide-react";

interface CourseProfile {
  id: string;
  userId: string | null;
  courseId: string;
  goal: string;
  background: string;
  targetOutcome: string;
  cognitiveStyle: string;
  title: string;
  description: string | null;
  difficulty: string;
  estimatedMinutes: number;
  outlineData: OutlineData;
  outlineMarkdown: string | null;
  designReason: string | null;
  currentChapter: number | null;
  currentSection: number | null;
  isCompleted: boolean | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

interface LearnPageClientProps {
  courseId: string;
  initialProfile: CourseProfile;
}

export default function LearnPageClient({
  courseId,
  initialProfile,
}: LearnPageClientProps) {
  const [courseProfile, setCourseProfile] = useState<CourseProfile>(initialProfile);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [chapters, setChapters] = useState<any[]>([]);
  const [isLoadingChapters, setIsLoadingChapters] = useState(true);
  const [isGenerationComplete, setIsGenerationComplete] = useState(false);

  // Load course chapters initially
  useEffect(() => {
    const loadChapters = async () => {
      try {
        const res = await fetch(`/api/courses/${courseId}/chapters`);
        if (!res.ok) throw new Error("Failed to fetch chapters");
        const data = await res.json();
        setChapters(data.chapters);
      } catch (err) {
        console.error("[LearnPageClient] Failed to load chapters:", err);
      } finally {
        setIsLoadingChapters(false);
      }
    };

    loadChapters();
  }, [courseId]);

  // 课程大纲中的总章节数（不需要每次重新计算）
  const totalChapters = useMemo(() => {
    return courseProfile.outlineData.modules?.reduce(
      (sum, m) => sum + (m.chapters?.length || 0),
      0
    ) || 0;
  }, [courseProfile.outlineData.modules]);

  // 定期刷新章节列表（当新章节被生成时）
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/courses/${courseId}/chapters`);
        if (!res.ok) throw new Error("Failed to fetch chapters");
        const data = await res.json();
        setChapters(data.chapters);

        // 检查是否所有章节都已生成
        if (data.chapters.length >= totalChapters) {
          setIsGenerationComplete(true);
          clearInterval(interval);
        }
      } catch (err) {
        console.error("[LearnPageClient] Failed to refresh chapters:", err);
      }
    }, 2000); // 每 2 秒检查一次

    return () => clearInterval(interval);
  }, [courseId, totalChapters]);

  // Chat setup for course-specific assistant
  const chatTransport = useMemo(
    () => new DefaultChatTransport({ api: "/api/ai" }),
    [],
  );

  const { messages, sendMessage, status, error } = useChat<InterviewAgentMessage>({
    transport: chatTransport,
  });

  const isLoading = status === "streaming" || status === "submitted";

  // Course outline from profile
  const outline = courseProfile.outlineData;

  // Current chapter content
  const currentChapter = chapters[currentChapterIndex];

  return (
    <div className="min-h-screen bg-[#FDFDFD] flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">{outline.title}</h1>
            <p className="text-sm text-gray-600 mt-1">{outline.description}</p>
          </div>
          <a
            href="/create"
            className="ml-4 px-4 py-2 text-gray-700 hover:text-gray-900 flex items-center gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            返回
          </a>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Course Outline */}
          <div className="lg:col-span-2">
            <ReadOnlyOutlineEditor outline={outline} />
          </div>

          {/* Right: Chat Assistant */}
          <div className="lg:col-span-1 flex flex-col gap-4">
            {/* Chapter Navigation */}
            {chapters.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">
                  章节内容 ({chapters.length})
                </h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {chapters.map((chapter, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentChapterIndex(idx)}
                      className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                        idx === currentChapterIndex
                          ? "bg-black text-white"
                          : "bg-gray-100 text-gray-900 hover:bg-gray-200"
                      }`}
                    >
                      <div className="font-medium">{chapter.title}</div>
                      <div className="text-xs opacity-75 mt-0.5">
                        Chapter {chapter.chapterIndex} • Section {chapter.sectionIndex}
                      </div>
                    </button>
                  ))}
                </div>

                {isLoadingChapters && (
                  <div className="text-center py-4 text-sm text-gray-500">
                    加载章节中...
                  </div>
                )}
              </div>
            )}

            {/* Course Chat */}
            <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col">
              <div className="px-4 py-3 border-b border-gray-200 flex-shrink-0">
                <h3 className="text-sm font-semibold text-gray-900">学习助手</h3>
              </div>

              <UnifiedChatUI
                messages={messages}
                isLoading={isLoading}
                input=""
                onInputChange={() => {}}
                onSubmit={(e) => {
                  e.preventDefault();
                  sendMessage(
                    { text: "继续" },
                    {
                      body: {
                        context: {
                          explicitIntent: "CHAT",
                          enableTools: true,
                        },
                      },
                    }
                  );
                }}
                variant="chat"
                placeholder="提问关于课程内容的问题..."
                renderMessage={(message, text) => (
                  <div className="px-3 py-2 text-xs">
                    <div className={message.role === "user" ? "text-right" : "text-left"}>
                      <div
                        className={`inline-block px-3 py-1 rounded-lg ${
                          message.role === "user"
                            ? "bg-black text-white"
                            : "bg-gray-100 text-gray-900"
                        }`}
                      >
                        {text}
                      </div>
                    </div>
                  </div>
                )}
                renderEmpty={() => (
                  <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                    有问题？问助手
                  </div>
                )}
              />
            </div>

            {/* Current Chapter Preview */}
            {currentChapter && (
              <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
                <h4 className="font-semibold text-gray-900 mb-2 text-sm">
                  当前章节
                </h4>
                <h5 className="font-bold text-gray-900 mb-2">{currentChapter.title}</h5>
                <div className="prose prose-sm max-w-none text-gray-700">
                  <p className="text-xs whitespace-pre-wrap line-clamp-4">
                    {currentChapter.contentMarkdown || "正在生成内容..."}
                  </p>
                </div>
                <button className="mt-4 w-full px-4 py-2 bg-black text-white text-sm font-medium rounded hover:bg-gray-800 transition-colors">
                  阅读完整内容
                </button>
              </div>
            )}

            {/* Course Generation Status */}
            {!isGenerationComplete && chapters.length < totalChapters && (
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg shadow-sm p-4 border border-blue-200">
                <div className="flex items-start gap-3">
                  <Zap className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0 animate-pulse" />
                  <div className="flex-1">
                    <h4 className="font-semibold text-blue-900 text-sm">
                      正在生成课程内容
                    </h4>
                    <p className="text-xs text-blue-700 mt-1">
                      {chapters.length} / {totalChapters} 章节已生成
                    </p>
                  </div>
                </div>
              </div>
            )}

            {isGenerationComplete && (
              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg shadow-sm p-4 border border-green-200">
                <p className="font-semibold text-green-900 text-sm">
                  ✅ 课程生成完毕！现在可以开始学习了。
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
