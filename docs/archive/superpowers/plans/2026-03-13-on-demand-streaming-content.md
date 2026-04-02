# On-Demand Streaming Content Generation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add on-demand streaming chapter content generation and per-chapter AI chat to the learning page.

**Architecture:** Two independent channels — (1) a dedicated `POST /api/learn/generate` route that streams Markdown via `streamText()` with `proModel`, rendered by `StreamdownMessage` during generation and converted to HTML for `Editor` after completion; (2) a per-chapter AI chat panel reusing `useChat` + `DefaultChatTransport` against `/api/chat` with chapter context injection. Three-column layout: sidebar | content | chat.

**Tech Stack:** AI SDK v6 (`streamText`, `useChat`, `DefaultChatTransport`), `marked` (already a dependency), Tiptap Editor, StreamdownMessage, Zustand, Drizzle ORM.

**Note:** This is archived historical material. Current repository guidance lives in `AGENTS.md`; at the time of writing, this project had no automated test infrastructure and relied on manual verification.

---

## File Structure

| File | Responsibility | Action |
|------|---------------|--------|
| `lib/ai/prompts/learn.ts` | Chapter content generation prompt builder | Create |
| `app/api/learn/generate/route.ts` | Streaming content generation API endpoint | Create |
| `hooks/useChapterGeneration.ts` | Frontend hook for streaming content consumption | Create |
| `stores/learn.ts` | Learn store — add generation state, chat visibility | Modify |
| `app/learn/[id]/components/ChapterContent.tsx` | Orchestrates streaming display → editor transition | Create |
| `app/learn/[id]/components/LearnChat.tsx` | Right-side AI chat panel | Create |
| `app/learn/[id]/LearnClient.tsx` | Three-column layout, wire up chat panel | Modify |
| `app/learn/[id]/components/LearnEditor.tsx` | Remove (replaced by ChapterContent) | Delete |

---

## Chunk 1: Content Generation Backend

### Task 1: Create chapter content prompt

**Files:**
- Create: `lib/ai/prompts/learn.ts`

- [ ] **Step 1: Create the prompt file**

```typescript
// lib/ai/prompts/learn.ts

/**
 * 章节内容生成 Prompt
 *
 * 根据课程大纲和章节信息，生成完整的教学内容。
 */
export function buildChapterPrompt(params: {
  courseTitle: string;
  courseDescription: string;
  targetAudience: string;
  difficulty: string;
  chapterIndex: number;
  chapterTitle: string;
  chapterDescription: string;
  topics: string[];
  totalChapters: number;
  outlineSummary: string;
}): string {
  const {
    courseTitle,
    courseDescription,
    targetAudience,
    difficulty,
    chapterIndex,
    chapterTitle,
    chapterDescription,
    topics,
    totalChapters,
    outlineSummary,
  } = params;

  const difficultyLabel =
    difficulty === "beginner" ? "入门" : difficulty === "intermediate" ? "中级" : "高级";

  return `你是一位专业的课程内容创作者，正在为在线学习平台编写教学内容。

## 课程信息
- 课程名称：${courseTitle}
- 课程简介：${courseDescription}
- 目标受众：${targetAudience}
- 难度级别：${difficultyLabel}
- 总章节数：${totalChapters}

## 当前章节
- 第 ${chapterIndex + 1} 章：${chapterTitle}
- 章节描述：${chapterDescription}
- 涵盖主题：${topics.join("、")}

## 课程大纲（全貌）
${outlineSummary}

## 内容生成要求

1. **篇幅**：2000-4000 字的完整教学内容
2. **结构**：使用清晰的 Markdown 格式
   - 以二级标题 (##) 开始每个主要知识点
   - 合理使用三级标题 (###) 组织子内容
   - 使用列表、粗体、引用等增强可读性
3. **教学法**：
   - 概念讲解要通俗易懂，配合生动的类比或示例
   - 每个核心知识点后附带实际应用场景
   - 章节末尾提供关键要点总结
4. **语言**：中文，语气专业但亲切
5. **连贯性**：注意与前后章节的衔接，避免内容重复

直接输出教学内容，不要输出任何前缀说明。`;
}
```

- [ ] **Step 2: Verify file compiles**

Run: `bunx tsc --noEmit lib/ai/prompts/learn.ts 2>&1 | head -5`
Expected: No errors (or only unrelated project-wide errors)

- [ ] **Step 3: Commit**

```bash
git add lib/ai/prompts/learn.ts
git commit -m "feat(learn): add chapter content generation prompt"
```

---

### Task 2: Create content generation API route

**Files:**
- Create: `app/api/learn/generate/route.ts`

**Reference patterns:**
- Auth: `app/api/interview/route.ts:15-28` — session + userId check
- Streaming: `lib/ai/core/streaming.ts` — smoothStream with Chinese segmentation
- DB: `db/schema.ts:174-204` — documents table schema
- Error handling: `lib/api/errors.ts` — APIError + handleError

- [ ] **Step 1: Create the route file**

```typescript
// app/api/learn/generate/route.ts

import { streamText } from "ai";
import { and, eq } from "drizzle-orm";
import { marked } from "marked";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { courseSessions, db, documents } from "@/db";
import { aiProvider } from "@/lib/ai/core";
import { buildChapterPrompt } from "@/lib/ai/prompts/learn";
import { APIError, handleError } from "@/lib/api";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 300;

const RequestSchema = z.object({
  courseId: z.string().uuid(),
  chapterIndex: z.number().int().min(0),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      throw new APIError("请先登录", 401, "UNAUTHORIZED");
    }

    if (!aiProvider.isConfigured()) {
      throw new APIError("AI 服务未配置", 503, "AI_NOT_CONFIGURED");
    }

    const body = await request.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new APIError("请求参数无效", 400, "VALIDATION_ERROR");
    }

    const { courseId, chapterIndex } = parsed.data;

    // Verify course ownership
    const [course] = await db
      .select()
      .from(courseSessions)
      .where(and(eq(courseSessions.id, courseId), eq(courseSessions.userId, userId)))
      .limit(1);

    if (!course) {
      throw new APIError("课程不存在", 404, "NOT_FOUND");
    }

    const outline = course.outlineData as {
      title?: string;
      description?: string;
      targetAudience?: string;
      chapters?: Array<{
        title: string;
        description?: string;
        topics?: string[];
      }>;
    } | null;

    const chapter = outline?.chapters?.[chapterIndex];
    if (!chapter) {
      throw new APIError("章节不存在", 404, "CHAPTER_NOT_FOUND");
    }

    // Check if content already exists
    const outlineNodeId = `chapter-${chapterIndex + 1}`;
    const [existingDoc] = await db
      .select({ id: documents.id, content: documents.content })
      .from(documents)
      .where(and(eq(documents.courseId, courseId), eq(documents.outlineNodeId, outlineNodeId)))
      .limit(1);

    if (existingDoc?.content) {
      const content = Buffer.isBuffer(existingDoc.content)
        ? existingDoc.content.toString("utf-8")
        : "";
      return NextResponse.json({
        exists: true,
        content,
        documentId: existingDoc.id,
      });
    }

    // Build prompt
    const systemPrompt = buildChapterPrompt({
      courseTitle: course.title ?? "",
      courseDescription: outline?.description ?? "",
      targetAudience: outline?.targetAudience ?? "",
      difficulty: course.difficulty ?? "beginner",
      chapterIndex,
      chapterTitle: chapter.title,
      chapterDescription: chapter.description ?? "",
      topics: chapter.topics ?? [],
      totalChapters: outline?.chapters?.length ?? 0,
      outlineSummary:
        outline?.chapters
          ?.map((c: { title: string }, i: number) => `${i + 1}. ${c.title}`)
          .join("\n") ?? "",
    });

    // Stream text generation
    const result = streamText({
      model: aiProvider.proModel,
      system: systemPrompt,
      prompt: `请为「${chapter.title}」生成完整的教学内容。`,
      temperature: 0.5,
      onFinish: async ({ text }) => {
        try {
          // Convert markdown to HTML for Tiptap Editor
          const html = await marked.parse(text, { gfm: true, breaks: true });

          if (existingDoc) {
            await db
              .update(documents)
              .set({
                content: Buffer.from(html),
                plainText: text,
                updatedAt: new Date(),
              })
              .where(eq(documents.id, existingDoc.id));
          } else {
            await db.insert(documents).values({
              type: "course_chapter",
              title: chapter.title,
              courseId,
              outlineNodeId,
              content: Buffer.from(html),
              plainText: text,
            });
          }
        } catch (err) {
          console.error("[Learn/Generate] Failed to persist chapter content:", err);
        }
      },
    });

    // Return plain text stream
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of result.textStream) {
            controller.enqueue(encoder.encode(chunk));
          }
        } catch (err) {
          console.error("[Learn/Generate] Stream error:", err);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "X-Content-Type-Options": "nosniff",
        "X-Course-Id": courseId,
        "X-Chapter-Index": String(chapterIndex),
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
```

- [ ] **Step 2: Verify route compiles**

Run: `bunx tsc --noEmit app/api/learn/generate/route.ts 2>&1 | head -10`

- [ ] **Step 3: Manual test — verify endpoint responds**

Start dev server (`bun dev`), then:
```bash
curl -X POST http://localhost:3000/api/learn/generate \
  -H "Content-Type: application/json" \
  -d '{"courseId":"invalid","chapterIndex":0}'
```
Expected: 401 (not logged in) or 400 (validation error). Confirms route is mounted.

- [ ] **Step 4: Commit**

```bash
git add app/api/learn/generate/route.ts
git commit -m "feat(learn): add streaming content generation API route"
```

---

## Chunk 2: Frontend Streaming Hook & Store

### Task 3: Create useChapterGeneration hook

**Files:**
- Create: `hooks/useChapterGeneration.ts`

**Reference patterns:**
- `hooks/useInterview.ts` — hook structure, state management, abort handling

- [ ] **Step 1: Create the hook file**

```typescript
// hooks/useChapterGeneration.ts

import { marked } from "marked";
import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";

interface UseChapterGenerationOptions {
  courseId: string;
  chapterIndex: number;
  chapterTitle: string;
  /** Only trigger generation when true (chapter has no existing content) */
  enabled: boolean;
}

interface UseChapterGenerationReturn {
  /** Accumulated markdown text during streaming */
  streamingContent: string;
  /** HTML content after generation completes (for Editor) */
  htmlContent: string;
  /** Whether content is currently being generated */
  isGenerating: boolean;
  /** Whether generation completed successfully */
  isComplete: boolean;
  /** Error message if generation failed */
  error: string | null;
}

export function useChapterGeneration({
  courseId,
  chapterIndex,
  chapterTitle,
  enabled,
}: UseChapterGenerationOptions): UseChapterGenerationReturn {
  const { addToast } = useToast();
  const [streamingContent, setStreamingContent] = useState("");
  const [htmlContent, setHtmlContent] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const generatedRef = useRef<Set<string>>(new Set());

  const generate = useCallback(async () => {
    const key = `${courseId}-${chapterIndex}`;
    if (generatedRef.current.has(key)) return;
    generatedRef.current.add(key);

    setStreamingContent("");
    setHtmlContent("");
    setIsGenerating(true);
    setIsComplete(false);
    setError(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/learn/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, chapterIndex }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error?.message || `生成失败 (${response.status})`);
      }

      // Check if content already exists (non-streaming response)
      const contentType = response.headers.get("Content-Type") ?? "";
      if (contentType.includes("application/json")) {
        const data = await response.json();
        if (data.exists && data.content) {
          setHtmlContent(data.content);
          setIsComplete(true);
          setIsGenerating(false);
          return;
        }
      }

      // Consume text stream
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        fullText += chunk;
        setStreamingContent(fullText);
      }

      // Convert markdown to HTML for Editor
      const html = await marked.parse(fullText, { gfm: true, breaks: true });
      setHtmlContent(html);
      setIsComplete(true);
    } catch (err) {
      // Allow retry on abort or error
      generatedRef.current.delete(key);
      if ((err as Error).name === "AbortError") return;
      const message = err instanceof Error ? err.message : "内容生成失败";
      setError(message);
      addToast(message, "error");
    } finally {
      setIsGenerating(false);
      abortRef.current = null;
    }
  }, [courseId, chapterIndex, addToast]);

  // Trigger generation when enabled
  useEffect(() => {
    if (enabled) {
      generate();
    }

    return () => {
      abortRef.current?.abort();
    };
  }, [enabled, generate]);

  // Reset state when chapter changes
  useEffect(() => {
    setStreamingContent("");
    setHtmlContent("");
    setIsGenerating(false);
    setIsComplete(false);
    setError(null);
  }, [chapterIndex]);

  return {
    streamingContent,
    htmlContent,
    isGenerating,
    isComplete,
    error,
  };
}
```

- [ ] **Step 2: Verify compiles**

Run: `bunx tsc --noEmit hooks/useChapterGeneration.ts 2>&1 | head -5`

- [ ] **Step 3: Commit**

```bash
git add hooks/useChapterGeneration.ts
git commit -m "feat(learn): add useChapterGeneration streaming hook"
```

---

### Task 4: Update learn store

**Files:**
- Modify: `stores/learn.ts`

**Context:** Add chat panel visibility state and per-chapter generation tracking.

- [ ] **Step 1: Add chat visibility and generation state to the store**

In `stores/learn.ts`, add after the existing `completedChapters` fields:

```typescript
// Add to LearnState interface (after completedChapters):
  // Chat panel
  isChatOpen: boolean;
  toggleChat: () => void;
  setChatOpen: (open: boolean) => void;

  // Generation tracking (which chapters have been generated this session)
  generatedChapters: Set<number>;
  markChapterGenerated: (index: number) => void;
```

Add to `initialState`:
```typescript
  isChatOpen: true,
  generatedChapters: new Set<number>(),
```

Add implementations in the `create` callback:
```typescript
  toggleChat: () => set((state) => ({ isChatOpen: !state.isChatOpen })),
  setChatOpen: (isChatOpen) => set({ isChatOpen }),

  markChapterGenerated: (index) =>
    set((state) => {
      const generatedChapters = new Set(state.generatedChapters);
      generatedChapters.add(index);
      return { generatedChapters };
    }),
```

- [ ] **Step 2: Verify compiles**

Run: `bunx tsc --noEmit stores/learn.ts 2>&1 | head -5`

- [ ] **Step 3: Commit**

```bash
git add stores/learn.ts
git commit -m "feat(learn): add chat visibility and generation tracking to store"
```

---

## Chunk 3: Content Display Component

### Task 5: Create ChapterContent component (replaces LearnEditor)

**Files:**
- Create: `app/learn/[id]/components/ChapterContent.tsx`
- Delete: `app/learn/[id]/components/LearnEditor.tsx`

**Context:** This component orchestrates the chapter display lifecycle:
1. Chapter has existing content → show Editor (editable)
2. Chapter has no content → trigger generation → show StreamdownMessage (streaming) → show Editor (editable)

**Reference patterns:**
- `components/chat/StreamdownMessage.tsx` — streaming markdown render
- `components/editor/Editor.tsx` — Tiptap editor component
- `hooks/useChapterGeneration.ts` — streaming hook (Task 3)

- [ ] **Step 1: Create ChapterContent component**

```typescript
// app/learn/[id]/components/ChapterContent.tsx

"use client";

import { AnimatePresence, motion } from "framer-motion";
import { FileText, Loader2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StreamdownMessage } from "@/components/chat/StreamdownMessage";
import { Editor } from "@/components/editor";
import { useChapterGeneration } from "@/hooks/useChapterGeneration";
import { cn } from "@/lib/utils";
import { useLearnStore } from "@/stores/learn";

interface ChapterDoc {
  id: string;
  title: string | null;
  content: Buffer | null;
  outlineNodeId: string | null;
}

interface ChapterContentProps {
  courseId: string;
  chapterDocs: ChapterDoc[];
}

/** Parse Buffer content to string */
function parseBufferContent(content: Buffer | null): string {
  if (!content) return "";

  const bufferData = content as Buffer | { type: string; data: number[] } | string;

  if (Buffer.isBuffer(bufferData)) {
    return bufferData.toString("utf-8");
  }
  if (
    bufferData &&
    typeof bufferData === "object" &&
    "type" in bufferData &&
    (bufferData as { type: string }).type === "Buffer" &&
    "data" in bufferData
  ) {
    return Buffer.from((bufferData as { data: number[] }).data).toString("utf-8");
  }
  if (typeof bufferData === "string") {
    return bufferData;
  }
  return "";
}

function GeneratingState({ chapterTitle }: { chapterTitle: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center h-full text-zinc-400 p-8"
    >
      <div className="w-20 h-20 rounded-2xl bg-[var(--color-bg-secondary)] flex items-center justify-center mb-4">
        <Loader2 className="w-10 h-10 text-[var(--color-accent)] animate-spin" />
      </div>
      <h3 className="text-lg font-medium text-zinc-600 mb-2">正在生成内容</h3>
      <p className="text-sm text-center max-w-sm">
        正在为「{chapterTitle}」生成教学内容，请稍候...
      </p>
    </motion.div>
  );
}

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center h-full text-zinc-400 p-8"
    >
      <div className="w-20 h-20 rounded-2xl bg-[var(--color-bg-secondary)] flex items-center justify-center mb-4">
        <FileText className="w-10 h-10 text-zinc-300" />
      </div>
      <h3 className="text-lg font-medium text-zinc-600 mb-2">暂无内容</h3>
      <p className="text-sm text-center max-w-sm">该章节内容尚未生成。</p>
    </motion.div>
  );
}

export function ChapterContent({ courseId, chapterDocs }: ChapterContentProps) {
  const { currentChapterIndex, isZenMode, chapters, markChapterGenerated } = useLearnStore();
  const currentChapter = chapters[currentChapterIndex];

  // Match chapter doc by outlineNodeId (not by index)
  const existingContent = useMemo(() => {
    if (!currentChapter) return "";
    const nodeId = currentChapter.nodeId;
    const doc = chapterDocs.find((d) => d.outlineNodeId === nodeId);
    return parseBufferContent(doc?.content ?? null);
  }, [chapterDocs, currentChapter, currentChapterIndex]);

  // Determine if we need to generate
  const needsGeneration = !existingContent && !!currentChapter;

  // Streaming generation hook
  const { streamingContent, htmlContent, isGenerating, isComplete, error } = useChapterGeneration({
    courseId,
    chapterIndex: currentChapterIndex,
    chapterTitle: currentChapter?.title ?? "",
    enabled: needsGeneration,
  });

  // Track generated chapters
  useEffect(() => {
    if (isComplete) {
      markChapterGenerated(currentChapterIndex);
    }
  }, [isComplete, currentChapterIndex, markChapterGenerated]);

  // Determine what to display
  const editorContent = existingContent || htmlContent;
  const showEditor = !!editorContent && !isGenerating;
  const showStreaming = isGenerating && streamingContent.length > 0;
  const showInitialLoading = isGenerating && streamingContent.length === 0;

  // Handle content change — TODO: implement auto-save
  const handleContentChange = useCallback((_html: string) => {
    // Future: auto-save to documents table
  }, []);

  if (!currentChapter) {
    return <EmptyState />;
  }

  return (
    <div className="h-full overflow-auto">
      <AnimatePresence mode="wait">
        {showInitialLoading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-full"
          >
            <GeneratingState chapterTitle={currentChapter.title} />
          </motion.div>
        ) : showStreaming ? (
          <motion.div
            key="streaming"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={cn(
              "h-full overflow-auto",
              isZenMode ? "max-w-3xl mx-auto px-8 py-12" : "p-6 md:p-8 lg:p-10",
            )}
          >
            {/* Chapter header */}
            {!isZenMode && (
              <div className="mb-6 pb-4 border-b border-[var(--color-border)]">
                <div className="flex items-center gap-2 text-xs text-[var(--color-accent)] mb-2">
                  <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                  <span>第 {currentChapterIndex + 1} 章 · 生成中...</span>
                </div>
                <h2 className="text-xl font-semibold text-zinc-900">{currentChapter.title}</h2>
              </div>
            )}

            <StreamdownMessage content={streamingContent} isStreaming={true} />
          </motion.div>
        ) : showEditor ? (
          <motion.div
            key={`editor-${currentChapterIndex}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className={cn(
              "h-full",
              isZenMode ? "max-w-3xl mx-auto px-8 py-12" : "p-6 md:p-8 lg:p-10",
            )}
          >
            {/* Chapter header */}
            {!isZenMode && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 pb-4 border-b border-[var(--color-border)]"
              >
                <div className="flex items-center gap-2 text-xs text-[var(--color-accent)] mb-2">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>第 {currentChapterIndex + 1} 章</span>
                </div>
                <h2 className="text-xl font-semibold text-zinc-900">{currentChapter.title}</h2>
              </motion.div>
            )}

            {/* Editable Editor */}
            <div className="prose prose-zinc max-w-none">
              <Editor
                content={editorContent}
                onChange={handleContentChange}
                placeholder="章节内容..."
              />
            </div>
          </motion.div>
        ) : error ? (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center h-full text-zinc-400 p-8"
          >
            <h3 className="text-lg font-medium text-red-600 mb-2">生成失败</h3>
            <p className="text-sm text-center max-w-sm text-zinc-500">{error}</p>
          </motion.div>
        ) : (
          <EmptyState />
        )}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 2: Verify compiles**

Run: `bunx tsc --noEmit app/learn/[id]/components/ChapterContent.tsx 2>&1 | head -10`

- [ ] **Step 3: Commit**

```bash
git add app/learn/[id]/components/ChapterContent.tsx
git commit -m "feat(learn): add ChapterContent with streaming generation"
```

---

## Chunk 4: AI Chat Panel & Layout Integration

### Task 6: Create LearnChat component

**Files:**
- Create: `app/learn/[id]/components/LearnChat.tsx`

**Context:** Right-side chat panel that reuses existing chat infrastructure. Per-chapter sessions with chapter context.

**Reference patterns:**
- `components/chat/ChatPanel.tsx` — message list, input area, send message
- `components/chat/useChatSession.ts` — useChat + DefaultChatTransport
- `components/chat/ChatMessage.tsx` — message rendering
- `components/chat/StreamdownMessage.tsx` — streaming markdown

- [ ] **Step 1: Create LearnChat component**

```typescript
// app/learn/[id]/components/LearnChat.tsx

"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, Loader2, MessageSquare, Send, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChatMessage, LoadingDots } from "@/components/chat/ChatMessage";
import { useToast } from "@/components/ui/Toast";
import { parseApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { useLearnStore } from "@/stores/learn";

interface LearnChatProps {
  courseId: string;
  courseTitle: string;
}

export function LearnChat({ courseId, courseTitle }: LearnChatProps) {
  const { addToast } = useToast();
  const { currentChapterIndex, chapters, isChatOpen, setChatOpen } = useLearnStore();
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const currentChapter = chapters[currentChapterIndex];
  const sessionId = `learn-${courseId}-ch${currentChapterIndex}`;

  const chat = useChat({
    id: sessionId,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: () => ({
        sessionId,
        metadata: {
          courseId,
          courseTitle,
          chapterIndex: currentChapterIndex,
          chapterTitle: currentChapter?.title,
          context: "learn",
        },
      }),
    }),
    onError: (error) => {
      console.error("[LearnChat] Error:", error);
      parseApiError(error).then(({ message }) => {
        addToast(message, "error");
      });
    },
  });

  const { messages, sendMessage, status } = chat;
  const isLoading = status === "submitted" || status === "streaming";
  const chatMessages = messages.filter((m: UIMessage) => m.role !== "system");

  // Auto-scroll
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages.length, scrollToBottom]);

  const handleSubmit = async () => {
    if (!input.trim() || isLoading) return;
    await sendMessage({ text: input.trim() });
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const lastMsg = chatMessages[chatMessages.length - 1];
  const isAILoading =
    (status === "submitted" || status === "streaming") && (!lastMsg || lastMsg.role === "user");

  if (!isChatOpen) {
    return (
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        type="button"
        onClick={() => setChatOpen(true)}
        className={cn(
          "fixed right-6 bottom-20 z-50",
          "w-12 h-12 rounded-full shadow-lg",
          "bg-[var(--color-accent)] text-white",
          "flex items-center justify-center",
          "hover:bg-[var(--color-accent-hover)] transition-colors",
        )}
      >
        <MessageSquare className="w-5 h-5" />
      </motion.button>
    );
  }

  return (
    <motion.div
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 400, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="flex flex-col h-full border-l border-[var(--color-border)] bg-white flex-shrink-0 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[var(--color-accent-light)] flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-[var(--color-accent)]" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-zinc-900 truncate">AI 学习助手</h3>
            <p className="text-xs text-zinc-500 truncate">
              {currentChapter?.title ?? courseTitle}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setChatOpen(false)}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {chatMessages.length === 0 && !isLoading && (
          <div className="text-center py-8 text-zinc-400 text-sm">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>有什么不明白的？随时问我</p>
          </div>
        )}

        {chatMessages.map((msg) => (
          <ChatMessage
            key={msg.id}
            message={msg}
            onSendReply={(text) => sendMessage({ text })}
          />
        ))}

        {isAILoading && <LoadingDots />}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-[var(--color-border)] px-4 py-3">
        <div className="flex items-end gap-2 bg-zinc-50 rounded-xl p-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="针对本章节提问..."
            rows={1}
            className="flex-1 bg-transparent border-none outline-none text-sm text-zinc-900 placeholder:text-zinc-400 resize-none min-h-[24px] max-h-[80px]"
          />
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleSubmit}
            disabled={!input.trim() || isLoading}
            className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center transition-colors flex-shrink-0",
              input.trim() && !isLoading
                ? "bg-[var(--color-accent)] text-white"
                : "bg-zinc-200 text-zinc-400 cursor-not-allowed",
            )}
          >
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 2: Verify compiles**

Run: `bunx tsc --noEmit app/learn/[id]/components/LearnChat.tsx 2>&1 | head -10`

- [ ] **Step 3: Commit**

```bash
git add app/learn/[id]/components/LearnChat.tsx
git commit -m "feat(learn): add per-chapter AI chat panel"
```

---

### Task 7: Update LearnClient for three-column layout + delete LearnEditor

**Files:**
- Modify: `app/learn/[id]/LearnClient.tsx`
- Delete: `app/learn/[id]/components/LearnEditor.tsx`

**Context:** Change from two-column (sidebar + editor) to three-column (sidebar + content + chat). Pass courseId to ChapterContent and LearnChat. Delete old LearnEditor (replaced by ChapterContent).

- [ ] **Step 1: Rewrite LearnClient**

Replace the entire content of `app/learn/[id]/LearnClient.tsx`:

```typescript
// app/learn/[id]/LearnClient.tsx

"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { useLearnStore } from "@/stores/learn";

import { ChapterContent } from "./components/ChapterContent";
import { LearnChat } from "./components/LearnChat";
import { LearnSidebar } from "./components/LearnSidebar";
import { ZenModeToggle } from "./components/ZenModeToggle";

// Props types matching page.tsx data
export interface Chapter {
  id: string;
  title: string;
  nodeId: string;
}

export interface ChapterDoc {
  id: string;
  title: string | null;
  content: Buffer | null;
  outlineNodeId: string | null;
}

export interface LearnClientProps {
  sessionId: string;
  courseTitle: string;
  chapters: Chapter[];
  chapterDocs: ChapterDoc[];
  initialChapterIndex: number;
  progress: { completedChapters?: string[] } | null;
}

// Sidebar width constant
const SIDEBAR_WIDTH = 320;

// Animation variants
const sidebarVariants = {
  hidden: { width: 0, opacity: 0, x: -SIDEBAR_WIDTH },
  visible: {
    width: SIDEBAR_WIDTH,
    opacity: 1,
    x: 0,
    transition: { type: "spring" as const, stiffness: 300, damping: 30 },
  },
  exit: {
    width: 0,
    opacity: 0,
    x: -SIDEBAR_WIDTH,
    transition: { type: "spring" as const, stiffness: 300, damping: 30 },
  },
};

const mainVariants = {
  full: { marginLeft: 0 },
  withSidebar: {
    marginLeft: 0,
    transition: { type: "spring" as const, stiffness: 300, damping: 30 },
  },
};

export function LearnClient({
  sessionId,
  courseTitle,
  chapters,
  chapterDocs,
  initialChapterIndex,
  progress,
}: LearnClientProps) {
  // Get store actions and state
  const setChapters = useLearnStore((s) => s.setChapters);
  const setCurrentChapterIndex = useLearnStore((s) => s.setCurrentChapterIndex);
  const markChapterComplete = useLearnStore((s) => s.markChapterComplete);
  const isZenMode = useLearnStore((s) => s.isZenMode);
  const currentChapterIndex = useLearnStore((s) => s.currentChapterIndex);
  const isChatOpen = useLearnStore((s) => s.isChatOpen);

  // Initialize store on mount
  useEffect(() => {
    setChapters(chapters);
    setCurrentChapterIndex(initialChapterIndex);

    // Initialize completed chapters from progress
    if (progress?.completedChapters) {
      for (const chapterId of progress.completedChapters) {
        markChapterComplete(chapterId);
      }
    }
  }, [
    chapters,
    initialChapterIndex,
    progress,
    setChapters,
    setCurrentChapterIndex,
    markChapterComplete,
  ]);

  // Current chapter info
  const currentChapter = chapters[currentChapterIndex];

  return (
    <div className="flex h-screen bg-[var(--color-bg-secondary)]">
      {/* Sidebar - hidden in zen mode */}
      <AnimatePresence mode="wait">
        {!isZenMode && (
          <motion.div
            variants={sidebarVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="flex-shrink-0 overflow-hidden"
          >
            <LearnSidebar courseTitle={courseTitle} width={SIDEBAR_WIDTH} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content */}
      <motion.div
        variants={mainVariants}
        initial="full"
        animate={isZenMode ? "full" : "withSidebar"}
        className="flex-1 flex flex-col min-w-0 relative bg-white"
      >
        {/* Header - hidden in zen mode */}
        <AnimatePresence>
          {!isZenMode && (
            <motion.header
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)] bg-white"
            >
              <div className="flex items-center gap-3">
                {/* Chapter indicator */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-[var(--color-accent)] bg-[var(--color-accent-light)] px-2 py-1 rounded-full">
                    {currentChapterIndex + 1} / {chapters.length}
                  </span>
                </div>
                <h1 className="font-semibold text-zinc-900 truncate max-w-md">
                  {currentChapter?.title || courseTitle}
                </h1>
              </div>

              {/* Course title breadcrumb */}
              <div className="hidden md:flex items-center gap-2 text-sm text-zinc-500">
                <span className="truncate max-w-[200px]">{courseTitle}</span>
              </div>
            </motion.header>
          )}
        </AnimatePresence>

        {/* Chapter content (streaming generation + editor) */}
        <div className="flex-1 overflow-auto bg-[var(--color-bg)]">
          <ChapterContent courseId={sessionId} chapterDocs={chapterDocs} />
        </div>

        {/* Zen toggle */}
        <ZenModeToggle />
      </motion.div>

      {/* AI Chat panel - hidden in zen mode */}
      <AnimatePresence>
        {!isZenMode && (
          <LearnChat courseId={sessionId} courseTitle={courseTitle} />
        )}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 2: Verify compiles**

Run: `bunx tsc --noEmit app/learn/[id]/LearnClient.tsx 2>&1 | head -10`

- [ ] **Step 3: Delete old LearnEditor**

Delete `app/learn/[id]/components/LearnEditor.tsx` — fully replaced by `ChapterContent.tsx`.

- [ ] **Step 4: Manual verification**

Start dev server (`bun dev`):
1. Navigate to an existing course learning page
2. Verify three-column layout renders (sidebar + content + chat)
3. Verify sidebar navigation still works
4. Verify zen mode hides sidebar and chat panel
5. If the course has chapters, clicking a chapter should trigger content generation

- [ ] **Step 5: Commit**

```bash
git add app/learn/[id]/LearnClient.tsx
git rm app/learn/[id]/components/LearnEditor.tsx
git commit -m "feat(learn): three-column layout with streaming content and AI chat"
```

---

### Task 8: Final cleanup and integration verification

**Files:**
- Verify: `app/learn/[id]/page.tsx` — no changes needed (already passes sessionId, chapterDocs)
- Verify: `app/learn/[id]/components/ZenModeToggle.tsx` — no changes needed (zen mode already works)
- Cleanup: Remove any remaining imports of deleted `LearnEditor`

- [ ] **Step 1: Search for stale LearnEditor imports**

Run: `grep -r "LearnEditor" app/learn/ --include="*.tsx" --include="*.ts"`

If any file still imports `LearnEditor`, update it to use `ChapterContent` instead.

- [ ] **Step 2: Full typecheck**

Run: `bunx tsc --noEmit 2>&1 | grep -E "error TS" | head -20`

Fix any compilation errors in the new files.

- [ ] **Step 3: Dev server smoke test**

Start `bun dev` and verify:
1. `/learn/[id]` page loads without errors
2. Sidebar shows chapters correctly
3. Clicking a chapter triggers content generation (streaming text appears)
4. After generation completes, content is displayed in editable editor
5. AI chat panel opens/closes
6. Chat messages can be sent and received
7. Zen mode works (hides sidebar + chat)

- [ ] **Step 4: Commit cleanup**

```bash
git add -A
git commit -m "chore(learn): cleanup stale imports and verify integration"
```
