# Section-Based Learning Page Redesign — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the learning page from chapter-level to section-level content generation with read-only rendering and inline annotations (highlights + notes).

**Architecture:** Upgrade `Chapter.topics: string[]` → `Chapter.sections: Section[]` throughout the interview → learn pipeline. Replace the editable Tiptap Editor with `StreamdownMessage` (read-only Markdown) + annotation layer. Generate content per-section (500–1500 chars) with serial prefetch. Store raw Markdown in `documents.content` (no HTML conversion).

**Tech Stack:** Next.js 16, React 19 (with React Compiler), AI SDK v6, Zustand, Drizzle ORM, PostgreSQL + pgvector, StreamdownMessage, Framer Motion

**Spec:** `docs/archive/superpowers/specs/2026-03-13-section-based-learning-design.md`

---

## File Structure

### Modified Files
| File | Responsibility |
|------|---------------|
| `stores/interview.ts` | Add `Section` interface, change `Chapter.topics` → `Chapter.sections` |
| `lib/ai/tools/interview/index.ts` | Update `ConfirmOutlineSchema` to `sections` array + eager placeholder doc creation |
| `lib/ai/prompts/interview.ts` | Guide AI to generate structured sections with descriptions |
| `components/interview/OutlinePanel.tsx` | Display section title + description (replaces topic tags) |
| `components/chat/tool-result/CourseOutlineCard.tsx` | Update to render `sections` instead of `topics` |
| `components/chat/tool-result/types.ts` | Update `CourseChapter` type: `topics` → `sections` |
| `app/api/learn/generate/route.ts` | Accept `sectionIndex`, use `buildSectionPrompt`, store raw Markdown |
| `lib/ai/prompts/learn.ts` | `buildSectionPrompt` replaces `buildChapterPrompt` |
| `app/learn/[id]/page.tsx` | Query `course_section` docs, extract chapter > section structure, decode Buffer |
| `app/learn/[id]/LearnClient.tsx` | New `LearnClientProps` with `ChapterOutline[]` + `SectionDoc[]` |
| `app/learn/[id]/components/LearnSidebar.tsx` | Two-level chapter > section progress display |
| `app/learn/[id]/components/ChapterList.tsx` | Expandable chapter > section list with status indicators |
| `stores/learn.ts` | `currentSectionIndex`, `completedSections`, `expandedChapters` |

### New Files
| File | Responsibility |
|------|---------------|
| `hooks/useChapterSections.ts` | Multi-section generation + prefetch management |
| `hooks/useAnnotations.ts` | Highlight/note CRUD + PATCH API persistence |
| `app/api/learn/annotations/route.ts` | PATCH endpoint for annotation persistence |
| `app/learn/[id]/components/SectionReader.tsx` | Read-only section renderer with StreamdownMessage |
| `app/learn/[id]/components/TextSelectionToolbar.tsx` | Floating highlight/note toolbar |
| `app/learn/[id]/components/AnnotationLayer.tsx` | Highlight/note rendering overlay |

### Deleted Files
| File | Replaced By |
|------|------------|
| `app/learn/[id]/components/ChapterContent.tsx` | `SectionReader.tsx` |
| `hooks/useChapterGeneration.ts` | `hooks/useChapterSections.ts` |

---

## Chunk 1: Data Layer (Interview Store + Tool + Prompt)

### Task 1: Upgrade `stores/interview.ts` — Section type

**Files:**
- Modify: `stores/interview.ts:4-10`

- [ ] **Step 1: Add Section interface and update Chapter**

Replace the `Chapter` interface (lines 4-10):

```typescript
// stores/interview.ts

export interface Section {
  title: string;        // e.g., "变量与常量"
  description: string;  // e.g., "理解 Python 中变量的声明、赋值和命名规范"
}

export interface Chapter {
  title: string;
  description: string;
  sections: Section[];           // replaces topics: string[]
  estimatedMinutes?: number;
  practiceType?: "exercise" | "project" | "quiz" | "none";
}
```

`OutlineData` interface (lines 12-21) stays the same — it already uses `chapters: Chapter[]`.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `bunx tsc --noEmit 2>&1 | head -50`

Expected: Errors in files that still reference `chapter.topics` (OutlinePanel, learn prompt, etc.). These will be fixed in subsequent tasks.

- [ ] **Step 3: Commit**

```bash
git add stores/interview.ts
git commit -m "refactor(interview): upgrade Chapter.topics to Chapter.sections"
```

---

### Task 2: Update `ConfirmOutlineSchema` + eager placeholder doc creation

**Files:**
- Modify: `lib/ai/tools/interview/index.ts:1-94`

- [ ] **Step 1: Update the schema and imports**

Replace the entire file content:

```typescript
// lib/ai/tools/interview/index.ts

import { tool } from "ai";
import { z } from "zod";
import { and, courseSessions, db, documents, eq } from "@/db";

import type { ToolContext } from "@/lib/ai/core/tool-context";

// ============================================
// Schema
// ============================================

export const ConfirmOutlineSchema = z.object({
  title: z.string().describe("课程标题"),
  description: z.string().describe("一句话课程描述"),
  targetAudience: z.string().describe("适合谁学"),
  prerequisites: z.array(z.string()).optional().describe("前置知识要求"),
  estimatedHours: z.number().describe("预计总学时（小时）"),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]).describe("整体难度"),
  chapters: z
    .array(
      z.object({
        title: z.string().describe("章节标题"),
        description: z.string().describe("章节简介"),
        sections: z
          .array(
            z.object({
              title: z.string().describe("小节标题"),
              description: z.string().describe("小节知识点描述"),
            }),
          )
          .min(1)
          .describe("小节列表"),
        estimatedMinutes: z.number().optional().describe("预计学习时长（分钟）"),
        practiceType: z
          .enum(["exercise", "project", "quiz", "none"])
          .optional()
          .describe("实践类型"),
      }),
    )
    .min(1)
    .describe("章节列表"),
  learningOutcome: z.string().describe("学完能做什么"),
});

// ============================================
// Types
// ============================================

export interface ConfirmOutlineOutput {
  success: boolean;
  outline?: z.infer<typeof ConfirmOutlineSchema>;
  error?: string;
}

// ============================================
// Tool Factory
// ============================================

export const createInterviewTools = (ctx: ToolContext) => {
  const courseId = ctx.resourceId;

  if (!courseId) {
    throw new Error("Interview tools require resourceId (courseId)");
  }

  return {
    confirmOutline: tool({
      description:
        "生成或更新课程大纲。当你对用户需求了解充分时调用。用户提出修改建议时再次调用更新。",
      inputSchema: ConfirmOutlineSchema,
      execute: async (outline): Promise<ConfirmOutlineOutput> => {
        const course = await db.query.courseSessions.findFirst({
          where: eq(courseSessions.id, courseId),
        });

        if (!course) {
          return { success: false, error: "课程不存在" };
        }

        if (course.userId !== ctx.userId) {
          return { success: false, error: "无权修改此课程" };
        }

        // Save outline to course session
        await db
          .update(courseSessions)
          .set({
            title: outline.title,
            description: outline.description,
            difficulty: outline.difficulty,
            estimatedMinutes: Math.round(outline.estimatedHours * 60),
            outlineData: outline,
            interviewStatus: "completed",
            status: "outline_confirmed",
            updatedAt: new Date(),
          })
          .where(eq(courseSessions.id, courseId));

        // --- Eager placeholder document creation ---
        // Clear old section documents (supports outline re-confirmation during interview)
        await db.delete(documents).where(
          and(eq(documents.courseId, courseId), eq(documents.type, "course_section")),
        );

        // Create one placeholder document per section
        for (let chIdx = 0; chIdx < outline.chapters.length; chIdx++) {
          const chapter = outline.chapters[chIdx];
          for (let secIdx = 0; secIdx < chapter.sections.length; secIdx++) {
            const section = chapter.sections[secIdx];
            // No unique constraint on (courseId, outlineNodeId), but the delete above
            // clears old rows so duplicates are not a concern within this execute call.
            await db
              .insert(documents)
              .values({
                type: "course_section",
                title: section.title,
                courseId: courseId,
                outlineNodeId: `section-${chIdx + 1}-${secIdx + 1}`,
                content: null,
                plainText: null,
              });
          }
        }

        return { success: true, outline };
      },
    }),
  };
};
```

- [ ] **Step 2: Verify TypeScript compiles for this file**

Run: `bunx tsc --noEmit 2>&1 | grep "interview/index"`

Expected: No errors in this file specifically. Other files may still error (expected).

- [ ] **Step 3: Commit**

```bash
git add lib/ai/tools/interview/index.ts
git commit -m "feat(interview): sections schema + eager placeholder doc creation"
```

---

### Task 3: Update interview prompt to generate structured sections

**Files:**
- Modify: `lib/ai/prompts/interview.ts:1-40`

- [ ] **Step 1: Update the prompt**

Replace the entire file:

```typescript
// lib/ai/prompts/interview.ts

export const INTERVIEW_PROMPT = `你是 NexusNote 的课程规划师。通过自然对话深入了解用户的学习需求，然后生成高质量的个性化课程大纲。

## 访谈策略

- 像一个有经验的导师，通过对话了解学生
- 根据用户回答的深度和清晰度决定是否追问
- 不要机械地逐条提问，让对话自然流动
- 用户表达清晰时可以少问，模糊时要深挖
- 一般 2-5 轮对话即可，不要拖沓

## 你需要理解的维度（不是固定顺序，不是必须全问）

- 学什么、为什么学（目标和动机）
- 现在懂多少（知识基础）
- 学完想达到什么程度（期望成果）
- 有多少时间、什么偏好（学习条件，可选）

## 何时生成大纲

当你觉得对用户需求的理解足够生成一份有针对性的大纲时，直接调用 confirmOutline。
不需要等用户确认，不需要集齐所有维度。信息够用就行。

## 大纲结构要求

大纲必须包含结构化的小节（sections），而不是简单的知识点列表：
- 每个章节下包含 2-5 个小节（sections）
- 每个小节有明确的标题（title）和描述（description）
- 小节标题应简洁，如"变量与常量"、"条件语句"
- 小节描述应说明学什么、为什么重要，1-2句话即可
- 小节粒度：一个独立知识点，学习时间约5-15分钟

## 大纲修改

用户对大纲提出修改意见时，理解需求后再次调用 confirmOutline 生成完整的新版本。
- 每次调用 confirmOutline 都是完整替换，不要在标题中标注版本号（如V1.0、V2.0）
- 大纲会自动显示在左侧面板，不需要让用户刷新或查看
- 修改后简单说明改了什么即可

## 快捷选项

每轮提问后，调用一次 suggestOptions 给用户 2-4 个快捷回复选项。
- 每轮只调用一次，不要重复调用
- 选项要简短有用，帮助用户快速回答

## 对话风格

像朋友聊天，简洁自然，每轮只问一个问题。`;
```

- [ ] **Step 2: Commit**

```bash
git add lib/ai/prompts/interview.ts
git commit -m "feat(interview): update prompt for structured sections"
```

---

### Task 4: Update OutlinePanel to display sections

**Files:**
- Modify: `components/interview/OutlinePanel.tsx:128-186`

- [ ] **Step 1: Replace the topics display with sections display**

In `OutlinePanel.tsx`, find the chapter rendering block (lines 128-186). Replace the `topics` rendering section (lines 156-166) with sections:

```typescript
// Replace chapter.topics rendering (lines 156-166) with:
{chapter.sections && chapter.sections.length > 0 && (
  <div className="mt-2 space-y-1.5">
    {chapter.sections.map((section, secIndex) => (
      <div
        key={`${section.title}-${secIndex}`}
        className="flex items-start gap-2 pl-1"
      >
        <span className="text-xs text-zinc-400 mt-0.5 shrink-0">
          {index + 1}.{secIndex + 1}
        </span>
        <div className="min-w-0">
          <span className="text-xs font-medium text-zinc-700">
            {section.title}
          </span>
          {section.description && (
            <p className="text-xs text-zinc-400 leading-relaxed">
              {section.description}
            </p>
          )}
        </div>
      </div>
    ))}
  </div>
)}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `bunx tsc --noEmit 2>&1 | head -30`

Expected: Fewer errors. The interview-side files should now be clean.

- [ ] **Step 3: Commit**

```bash
git add components/interview/OutlinePanel.tsx
git commit -m "feat(interview): display structured sections in outline panel"
```

---

### Task 4b: Update `CourseOutlineCard.tsx` and `types.ts` for sections

**Files:**
- Modify: `components/chat/tool-result/types.ts:110-114,193-198`
- Modify: `components/chat/tool-result/CourseOutlineCard.tsx:106-122`

- [ ] **Step 1: Update types.ts**

In `types.ts`, replace `CourseChapter` (lines 110-114):

```typescript
export interface CourseSection {
  title: string;
  description: string;
}

export interface CourseChapter {
  title: string;
  description: string;
  sections: CourseSection[];
}
```

Replace `ConfirmOutlineOutput.chapters` (lines 193-198):

```typescript
    chapters: Array<{
      title: string;
      description: string;
      sections: Array<{ title: string; description: string }>;
      estimatedMinutes?: number;
      practiceType?: "exercise" | "project" | "quiz" | "none";
    }>;
```

- [ ] **Step 2: Update CourseOutlineCard.tsx**

Replace the topics rendering block (lines 106-122):

```typescript
{chapter.sections && chapter.sections.length > 0 && (
  <div className="mt-2 space-y-1">
    {chapter.sections.slice(0, 3).map((section, secIdx) => (
      <div
        key={`section-${index}-${secIdx}`}
        className="text-xs text-[var(--color-text-secondary)]"
      >
        {index + 1}.{secIdx + 1} {section.title}
      </div>
    ))}
    {chapter.sections.length > 3 && (
      <span className="text-[var(--color-text-muted)] text-xs">
        +{chapter.sections.length - 3} 节
      </span>
    )}
  </div>
)}
```

- [ ] **Step 3: Commit**

```bash
git add components/chat/tool-result/types.ts components/chat/tool-result/CourseOutlineCard.tsx
git commit -m "refactor: update CourseOutlineCard for sections schema"
```

---

## Chunk 2: Learn Store + Generation Pipeline

### Task 5: Rewrite `stores/learn.ts` for section-level tracking

**Files:**
- Modify: `stores/learn.ts:1-88`

- [ ] **Step 1: Replace the entire store**

```typescript
/**
 * Learn Store - 课程学习状态管理
 *
 * 管理学习页面的章节/小节导航、禅模式和学习进度
 */

import { create } from "zustand";

export interface SectionOutline {
  title: string;
  description: string;
  nodeId: string;       // e.g., "section-1-1"
}

export interface ChapterOutline {
  title: string;
  description: string;
  sections: SectionOutline[];
}

interface LearnState {
  // Current chapter index
  currentChapterIndex: number;
  setCurrentChapterIndex: (index: number) => void;

  // Current section index (within chapter, driven by Intersection Observer)
  currentSectionIndex: number;
  setCurrentSectionIndex: (index: number) => void;

  // Chapter outlines (with sections)
  chapters: ChapterOutline[];
  setChapters: (chapters: ChapterOutline[]) => void;

  // Expanded chapters in sidebar
  expandedChapters: Set<number>;
  toggleChapterExpanded: (index: number) => void;

  // Completed sections (Set of nodeId strings like "section-1-1")
  completedSections: Set<string>;
  markSectionComplete: (nodeId: string) => void;

  // Zen mode (immersive learning)
  isZenMode: boolean;
  toggleZenMode: () => void;
  setZenMode: (isZen: boolean) => void;

  // Chat panel
  isChatOpen: boolean;
  toggleChat: () => void;
  setChatOpen: (open: boolean) => void;

  // Reset
  reset: () => void;
}

const initialState = {
  currentChapterIndex: 0,
  currentSectionIndex: 0,
  chapters: [] as ChapterOutline[],
  expandedChapters: new Set<number>(),
  completedSections: new Set<string>(),
  isZenMode: false,
  isChatOpen: true,
};

export const useLearnStore = create<LearnState>((set) => ({
  ...initialState,

  setCurrentChapterIndex: (index) =>
    set({ currentChapterIndex: index, currentSectionIndex: 0 }),

  setCurrentSectionIndex: (index) => set({ currentSectionIndex: index }),

  setChapters: (chapters) => set({ chapters }),

  toggleChapterExpanded: (index) =>
    set((state) => {
      const expanded = new Set(state.expandedChapters);
      if (expanded.has(index)) {
        expanded.delete(index);
      } else {
        expanded.add(index);
      }
      return { expandedChapters: expanded };
    }),

  markSectionComplete: (nodeId) =>
    set((state) => {
      const completed = new Set(state.completedSections);
      completed.add(nodeId);
      return { completedSections: completed };
    }),

  toggleZenMode: () => set((state) => ({ isZenMode: !state.isZenMode })),

  setZenMode: (isZenMode) => set({ isZenMode }),

  toggleChat: () => set((state) => ({ isChatOpen: !state.isChatOpen })),

  setChatOpen: (isChatOpen) => set({ isChatOpen }),

  reset: () => set(initialState),
}));
```

- [ ] **Step 2: Commit**

```bash
git add stores/learn.ts
git commit -m "refactor(learn): section-level state in learn store"
```

---

### Task 6: Rewrite `lib/ai/prompts/learn.ts` — `buildSectionPrompt`

**Files:**
- Modify: `lib/ai/prompts/learn.ts:1-66`

- [ ] **Step 1: Replace buildChapterPrompt with buildSectionPrompt**

```typescript
/**
 * 小节内容生成 Prompt
 *
 * 根据课程大纲和小节信息，生成聚焦单个知识点的教学内容。
 */
export function buildSectionPrompt(params: {
  courseTitle: string;
  courseDescription: string;
  targetAudience: string;
  difficulty: string;
  chapterIndex: number;
  chapterTitle: string;
  chapterDescription: string;
  sectionIndex: number;
  sectionTitle: string;
  sectionDescription: string;
  siblingTitles: string[];    // other section titles in the same chapter
  totalChapters: number;
}): string {
  const {
    courseTitle,
    courseDescription,
    targetAudience,
    difficulty,
    chapterIndex,
    chapterTitle,
    chapterDescription,
    sectionIndex,
    sectionTitle,
    sectionDescription,
    siblingTitles,
    totalChapters,
  } = params;

  const difficultyLabel =
    difficulty === "beginner" ? "入门" : difficulty === "intermediate" ? "中级" : "高级";

  const siblingContext = siblingTitles
    .map((t, i) => `  ${i === sectionIndex ? "→" : " "} ${chapterIndex + 1}.${i + 1} ${t}`)
    .join("\n");

  return `你是一位专业的课程内容创作者，正在为在线学习平台编写教学内容。

## 课程信息
- 课程名称：${courseTitle}
- 课程简介：${courseDescription}
- 目标受众：${targetAudience}
- 难度级别：${difficultyLabel}
- 总章节数：${totalChapters}

## 当前位置
- 第 ${chapterIndex + 1} 章：${chapterTitle}
- 章节描述：${chapterDescription}
- 本章小节：
${siblingContext}

## 当前小节
- ${chapterIndex + 1}.${sectionIndex + 1} ${sectionTitle}
- 描述：${sectionDescription}

## 内容生成要求

1. **篇幅**：500-1500 字，聚焦单个知识点
2. **结构**：使用清晰的 Markdown 格式
   - 以二级标题 (##) 开始本节内容
   - 合理使用三级标题 (###) 组织子内容
   - 使用列表、粗体、代码块、引用等增强可读性
3. **教学法**：
   - 概念讲解要通俗易懂，配合生动的类比或示例
   - 关键概念附带实际应用场景
   - 结尾简要总结要点（1-3条）
4. **语言**：中文，语气专业但亲切
5. **衔接**：注意与同章其他小节的关系，避免重复

直接输出教学内容，不要输出任何前缀说明。`;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/ai/prompts/learn.ts
git commit -m "feat(learn): buildSectionPrompt replaces buildChapterPrompt"
```

---

### Task 7: Rewrite `app/api/learn/generate/route.ts` for section-level generation

**Files:**
- Modify: `app/api/learn/generate/route.ts:1-181`

- [ ] **Step 1: Replace the entire route**

```typescript
// app/api/learn/generate/route.ts

import { smoothStream, streamText } from "ai";
import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { courseSessions, db, documents } from "@/db";
import { aiProvider } from "@/lib/ai/core";
import { buildSectionPrompt } from "@/lib/ai/prompts/learn";
import { APIError, handleError } from "@/lib/api";
import { auth } from "@/lib/auth";
import { checkRateLimitOrThrow } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 300;

const RequestSchema = z.object({
  courseId: z.string().uuid(),
  chapterIndex: z.number().int().min(0),
  sectionIndex: z.number().int().min(0),
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

    // Rate limit: 20 generate requests per minute per user
    checkRateLimitOrThrow(`learn-generate:${userId}`, 20, 60 * 1000);

    const body = await request.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new APIError("请求参数无效", 400, "VALIDATION_ERROR");
    }

    const { courseId, chapterIndex, sectionIndex } = parsed.data;

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
        sections?: Array<{ title: string; description: string }>;
      }>;
    } | null;

    const chapter = outline?.chapters?.[chapterIndex];
    if (!chapter) {
      throw new APIError("章节不存在", 404, "CHAPTER_NOT_FOUND");
    }

    const section = chapter.sections?.[sectionIndex];
    if (!section) {
      throw new APIError("小节不存在", 404, "SECTION_NOT_FOUND");
    }

    // Check if content already exists
    const outlineNodeId = `section-${chapterIndex + 1}-${sectionIndex + 1}`;
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

    // Build section prompt
    const siblingTitles = (chapter.sections ?? []).map((s) => s.title);
    const systemPrompt = buildSectionPrompt({
      courseTitle: course.title ?? "",
      courseDescription: outline?.description ?? "",
      targetAudience: outline?.targetAudience ?? "",
      difficulty: course.difficulty ?? "beginner",
      chapterIndex,
      chapterTitle: chapter.title,
      chapterDescription: chapter.description ?? "",
      sectionIndex,
      sectionTitle: section.title,
      sectionDescription: section.description,
      siblingTitles,
      totalChapters: outline?.chapters?.length ?? 0,
    });

    // Stream text generation with smoothStream for Chinese word boundaries
    const result = streamText({
      model: aiProvider.proModel,
      system: systemPrompt,
      prompt: `请为「${section.title}」生成教学内容。`,
      temperature: 0.5,
      experimental_transform: smoothStream({
        chunking: new Intl.Segmenter("zh-Hans", { granularity: "word" }),
      }),
      onFinish: async ({ text }) => {
        try {
          // Store raw Markdown (no HTML conversion) — StreamdownMessage renders Markdown directly
          if (existingDoc) {
            await db
              .update(documents)
              .set({
                content: Buffer.from(text),
                plainText: text,
                updatedAt: new Date(),
              })
              .where(eq(documents.id, existingDoc.id));
          } else {
            await db
              .insert(documents)
              .values({
                type: "course_section",
                title: section.title,
                courseId,
                outlineNodeId,
                content: Buffer.from(text),
                plainText: text,
              })
              .onConflictDoNothing();
          }
        } catch (err) {
          console.error("[Learn/Generate] Failed to persist section content:", err);
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
        "X-Section-Id": outlineNodeId,
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/learn/generate/route.ts
git commit -m "feat(learn): section-level generation API with raw Markdown storage"
```

---

### Task 8: Create `hooks/useChapterSections.ts` — section generation + prefetch

**Files:**
- Create: `hooks/useChapterSections.ts`
- Delete: `hooks/useChapterGeneration.ts`

- [ ] **Step 1: Create the hook**

```typescript
// hooks/useChapterSections.ts

import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";

export interface SectionState {
  content: string;         // raw Markdown
  status: "idle" | "generating" | "complete" | "error";
  documentId?: string;
  error?: string;
}

interface UseChapterSectionsOptions {
  courseId: string;
  chapterIndex: number;
  sectionCount: number;
  /** Pre-loaded content from server (nodeId → { content, documentId }) */
  initialContent: Map<string, { content: string; documentId: string }>;
}

interface UseChapterSectionsReturn {
  sections: Map<number, SectionState>;
  currentGenerating: number | null;
  generateSection: (sectionIndex: number) => void;
}

export function useChapterSections({
  courseId,
  chapterIndex,
  sectionCount,
  initialContent,
}: UseChapterSectionsOptions): UseChapterSectionsReturn {
  const { addToast } = useToast();
  const [sections, setSections] = useState<Map<number, SectionState>>(new Map());
  const [currentGenerating, setCurrentGenerating] = useState<number | null>(null);

  // Track in-flight request to prevent concurrency
  const inflightRef = useRef<AbortController | null>(null);
  const pendingRef = useRef<number | null>(null);
  const chapterRef = useRef(chapterIndex);

  // Initialize sections from server data on chapter change
  useEffect(() => {
    chapterRef.current = chapterIndex;
    inflightRef.current?.abort();
    inflightRef.current = null;
    pendingRef.current = null;
    setCurrentGenerating(null);

    const initial = new Map<number, SectionState>();
    for (let i = 0; i < sectionCount; i++) {
      const nodeId = `section-${chapterIndex + 1}-${i + 1}`;
      const existing = initialContent.get(nodeId);
      if (existing?.content) {
        initial.set(i, {
          content: existing.content,
          status: "complete",
          documentId: existing.documentId,
        });
      } else {
        initial.set(i, { content: "", status: "idle" });
      }
    }
    setSections(initial);
  }, [chapterIndex, sectionCount, initialContent]);

  // Core generate function
  const doGenerate = useCallback(
    async (sectionIndex: number) => {
      // Skip if already complete or generating
      const current = sections.get(sectionIndex);
      if (current?.status === "complete" || current?.status === "generating") return;

      const controller = new AbortController();
      inflightRef.current = controller;
      setCurrentGenerating(sectionIndex);

      setSections((prev) => {
        const next = new Map(prev);
        next.set(sectionIndex, { content: "", status: "generating" });
        return next;
      });

      try {
        const response = await fetch("/api/learn/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ courseId, chapterIndex, sectionIndex }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData?.error?.message || `生成失败 (${response.status})`);
        }

        // Check if content already exists (non-streaming JSON response)
        const contentType = response.headers.get("Content-Type") ?? "";
        if (contentType.includes("application/json")) {
          const data = await response.json();
          if (data.exists && data.content) {
            setSections((prev) => {
              const next = new Map(prev);
              next.set(sectionIndex, {
                content: data.content,
                status: "complete",
                documentId: data.documentId,
              });
              return next;
            });
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

          // Update streaming content
          const captured = fullText;
          setSections((prev) => {
            const next = new Map(prev);
            next.set(sectionIndex, { content: captured, status: "generating" });
            return next;
          });
        }

        // Mark complete
        setSections((prev) => {
          const next = new Map(prev);
          next.set(sectionIndex, { content: fullText, status: "complete" });
          return next;
        });
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        const message = err instanceof Error ? err.message : "内容生成失败";
        setSections((prev) => {
          const next = new Map(prev);
          next.set(sectionIndex, { content: "", status: "error", error: message });
          return next;
        });
        addToast(message, "error");
      } finally {
        inflightRef.current = null;
        setCurrentGenerating(null);

        // Prefetch: auto-trigger next section if still same chapter
        if (chapterRef.current === chapterIndex) {
          const pending = pendingRef.current;
          pendingRef.current = null;

          if (pending !== null) {
            // A specific section was requested while generating — prioritize it
            doGenerate(pending);
          } else {
            // Auto-prefetch next incomplete section
            for (let i = sectionIndex + 1; i < sectionCount; i++) {
              const s = sections.get(i);
              if (!s || s.status === "idle") {
                doGenerate(i);
                break;
              }
            }
          }
        }
      }
    },
    [courseId, chapterIndex, sectionCount, sections, addToast],
  );

  // Public generate — handles concurrency (serial, one at a time)
  const generateSection = useCallback(
    (sectionIndex: number) => {
      const s = sections.get(sectionIndex);
      if (s?.status === "complete") return;

      if (inflightRef.current) {
        // Already generating — queue this section for after current finishes
        pendingRef.current = sectionIndex;
        return;
      }

      doGenerate(sectionIndex);
    },
    [sections, doGenerate],
  );

  // Auto-start first ungenerated section on mount
  useEffect(() => {
    // Small delay to let initial state settle
    const timer = setTimeout(() => {
      for (let i = 0; i < sectionCount; i++) {
        const s = sections.get(i);
        if (!s || s.status === "idle") {
          generateSection(i);
          break;
        }
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [chapterIndex]); // Only re-trigger on chapter change

  return { sections, currentGenerating, generateSection };
}
```

- [ ] **Step 2: Delete old hook**

```bash
rm hooks/useChapterGeneration.ts
```

- [ ] **Step 3: Commit**

```bash
git add hooks/useChapterSections.ts
git rm hooks/useChapterGeneration.ts
git commit -m "feat(learn): useChapterSections hook with prefetch"
```

---

## Chunk 3: Annotation System

### Task 9: Create `app/api/learn/annotations/route.ts`

**Files:**
- Create: `app/api/learn/annotations/route.ts`

- [ ] **Step 1: Create the annotation PATCH endpoint**

```typescript
// app/api/learn/annotations/route.ts

import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { courseSessions, db, documents } from "@/db";
import { APIError, handleError } from "@/lib/api";
import { auth } from "@/lib/auth";

const AnnotationSchema = z.object({
  id: z.string(),
  type: z.enum(["highlight", "note"]),
  anchor: z.object({
    textContent: z.string(),
    startOffset: z.number(),
    endOffset: z.number(),
  }),
  color: z.string().optional(),
  noteContent: z.string().optional(),
  createdAt: z.string(),
});

const RequestSchema = z.object({
  documentId: z.string().uuid(),
  annotations: z.array(AnnotationSchema),
});

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      throw new APIError("请先登录", 401, "UNAUTHORIZED");
    }

    const body = await request.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new APIError("请求参数无效", 400, "VALIDATION_ERROR");
    }

    const { documentId, annotations } = parsed.data;

    // Verify document exists and belongs to user's course (JOIN for ownership check)
    const [doc] = await db
      .select({ id: documents.id })
      .from(documents)
      .innerJoin(courseSessions, eq(documents.courseId, courseSessions.id))
      .where(and(eq(documents.id, documentId), eq(courseSessions.userId, userId)))
      .limit(1);

    if (!doc) {
      throw new APIError("文档不存在", 404, "NOT_FOUND");
    }

    // Update metadata with full annotation replacement
    await db
      .update(documents)
      .set({
        metadata: { annotations },
        updatedAt: new Date(),
      })
      .where(eq(documents.id, documentId));

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleError(error);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/learn/annotations/route.ts
git commit -m "feat(learn): annotation PATCH API endpoint"
```

---

### Task 10: Create `hooks/useAnnotations.ts`

**Files:**
- Create: `hooks/useAnnotations.ts`

- [ ] **Step 1: Create the annotations hook**

```typescript
// hooks/useAnnotations.ts

import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";

export interface Annotation {
  id: string;
  type: "highlight" | "note";
  anchor: {
    textContent: string;     // ~50 chars surrounding the selection
    startOffset: number;
    endOffset: number;
  };
  color?: string;
  noteContent?: string;
  createdAt: string;
}

interface UseAnnotationsOptions {
  documentId: string | undefined;
  initialAnnotations: Annotation[];
}

interface UseAnnotationsReturn {
  annotations: Annotation[];
  addHighlight: (anchor: Annotation["anchor"], color?: string) => void;
  addNote: (anchor: Annotation["anchor"], noteContent: string, color?: string) => void;
  removeAnnotation: (id: string) => void;
  updateNote: (id: string, noteContent: string) => void;
}

export function useAnnotations({
  documentId,
  initialAnnotations,
}: UseAnnotationsOptions): UseAnnotationsReturn {
  const { addToast } = useToast();
  const [annotations, setAnnotations] = useState<Annotation[]>(initialAnnotations);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset when documentId changes
  useEffect(() => {
    setAnnotations(initialAnnotations);
  }, [documentId, initialAnnotations]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // Debounced save to API
  const scheduleSave = useCallback(
    (updated: Annotation[]) => {
      if (!documentId) return;

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }

      saveTimerRef.current = setTimeout(async () => {
        try {
          const response = await fetch("/api/learn/annotations", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ documentId, annotations: updated }),
          });
          if (!response.ok) {
            throw new Error("保存失败");
          }
        } catch {
          addToast("笔记保存失败，请稍后重试", "error");
        }
      }, 500);
    },
    [documentId, addToast],
  );

  const addHighlight = useCallback(
    (anchor: Annotation["anchor"], color = "#fef08a") => {
      const newAnnotation: Annotation = {
        id: crypto.randomUUID(),
        type: "highlight",
        anchor,
        color,
        createdAt: new Date().toISOString(),
      };
      setAnnotations((prev) => {
        const updated = [...prev, newAnnotation];
        scheduleSave(updated);
        return updated;
      });
    },
    [scheduleSave],
  );

  const addNote = useCallback(
    (anchor: Annotation["anchor"], noteContent: string, color = "#bbf7d0") => {
      const newAnnotation: Annotation = {
        id: crypto.randomUUID(),
        type: "note",
        anchor,
        noteContent,
        color,
        createdAt: new Date().toISOString(),
      };
      setAnnotations((prev) => {
        const updated = [...prev, newAnnotation];
        scheduleSave(updated);
        return updated;
      });
    },
    [scheduleSave],
  );

  const removeAnnotation = useCallback(
    (id: string) => {
      setAnnotations((prev) => {
        const updated = prev.filter((a) => a.id !== id);
        scheduleSave(updated);
        return updated;
      });
    },
    [scheduleSave],
  );

  const updateNote = useCallback(
    (id: string, noteContent: string) => {
      setAnnotations((prev) => {
        const updated = prev.map((a) => (a.id === id ? { ...a, noteContent } : a));
        scheduleSave(updated);
        return updated;
      });
    },
    [scheduleSave],
  );

  return { annotations, addHighlight, addNote, removeAnnotation, updateNote };
}
```

- [ ] **Step 2: Commit**

```bash
git add hooks/useAnnotations.ts
git commit -m "feat(learn): useAnnotations hook with debounced PATCH save"
```

---

## Chunk 4: UI Components (Reader + Toolbar + AnnotationLayer)

### Task 11: Create `TextSelectionToolbar.tsx`

**Files:**
- Create: `app/learn/[id]/components/TextSelectionToolbar.tsx`

- [ ] **Step 1: Create the floating toolbar component**

```typescript
// app/learn/[id]/components/TextSelectionToolbar.tsx

"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Highlighter, StickyNote } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { Annotation } from "@/hooks/useAnnotations";

interface TextSelectionToolbarProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  onHighlight: (anchor: Annotation["anchor"], color?: string) => void;
  onNote: (anchor: Annotation["anchor"]) => void;
  disabled?: boolean;
}

const HIGHLIGHT_COLORS = [
  { name: "黄色", value: "#fef08a" },
  { name: "绿色", value: "#bbf7d0" },
  { name: "蓝色", value: "#bfdbfe" },
  { name: "粉色", value: "#fecdd3" },
];

function getSelectionAnchor(
  selection: Selection,
  containerEl: HTMLElement,
): Annotation["anchor"] | null {
  if (selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  const selectedText = selection.toString().trim();
  if (!selectedText) return null;

  // Get surrounding context (~50 chars)
  const containerText = containerEl.textContent ?? "";
  const selectedStart = containerText.indexOf(selectedText);
  if (selectedStart === -1) return null;

  const contextStart = Math.max(0, selectedStart - 25);
  const contextEnd = Math.min(containerText.length, selectedStart + selectedText.length + 25);
  const textContent = containerText.slice(contextStart, contextEnd);

  return {
    textContent,
    startOffset: selectedStart - contextStart,
    endOffset: selectedStart - contextStart + selectedText.length,
  };
}

export function TextSelectionToolbar({
  containerRef,
  onHighlight,
  onNote,
  disabled = false,
}: TextSelectionToolbarProps) {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [showColors, setShowColors] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<Annotation["anchor"] | null>(null);

  const handleSelectionChange = useCallback(() => {
    if (disabled) {
      setPosition(null);
      return;
    }

    const selection = window.getSelection();
    if (
      !selection ||
      selection.isCollapsed ||
      !selection.toString().trim() ||
      !containerRef.current
    ) {
      setPosition(null);
      setShowColors(false);
      return;
    }

    // Check selection is within our container
    const range = selection.getRangeAt(0);
    if (!containerRef.current.contains(range.commonAncestorContainer)) {
      setPosition(null);
      return;
    }

    const rect = range.getBoundingClientRect();
    const containerRect = containerRef.current.getBoundingClientRect();

    anchorRef.current = getSelectionAnchor(selection, containerRef.current);

    setPosition({
      top: rect.top - containerRect.top - 48,
      left: rect.left - containerRect.left + rect.width / 2,
    });
  }, [containerRef, disabled]);

  useEffect(() => {
    document.addEventListener("selectionchange", handleSelectionChange);
    return () => document.removeEventListener("selectionchange", handleSelectionChange);
  }, [handleSelectionChange]);

  const handleHighlight = (color: string) => {
    if (!anchorRef.current) return;
    onHighlight(anchorRef.current, color);
    window.getSelection()?.removeAllRanges();
    setPosition(null);
    setShowColors(false);
  };

  const handleNote = () => {
    if (!anchorRef.current) return;
    onNote(anchorRef.current);
    window.getSelection()?.removeAllRanges();
    setPosition(null);
  };

  return (
    <AnimatePresence>
      {position && (
        <motion.div
          ref={toolbarRef}
          initial={{ opacity: 0, y: 5, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 5, scale: 0.95 }}
          transition={{ duration: 0.15 }}
          className="absolute z-50 flex items-center gap-1 bg-zinc-900 rounded-lg px-2 py-1.5 shadow-xl"
          style={{
            top: position.top,
            left: position.left,
            transform: "translateX(-50%)",
          }}
        >
          {showColors ? (
            <div className="flex items-center gap-1">
              {HIGHLIGHT_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => handleHighlight(c.value)}
                  className="w-6 h-6 rounded-full border-2 border-white/20 hover:scale-110 transition-transform"
                  style={{ backgroundColor: c.value }}
                  title={c.name}
                />
              ))}
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setShowColors(true)}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-white",
                  "hover:bg-white/10 transition-colors",
                )}
              >
                <Highlighter className="w-3.5 h-3.5" />
                <span>高亮</span>
              </button>
              <div className="w-px h-4 bg-white/20" />
              <button
                type="button"
                onClick={handleNote}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-white",
                  "hover:bg-white/10 transition-colors",
                )}
              >
                <StickyNote className="w-3.5 h-3.5" />
                <span>笔记</span>
              </button>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/learn/[id]/components/TextSelectionToolbar.tsx
git commit -m "feat(learn): TextSelectionToolbar for inline annotations"
```

---

### Task 12: Create `AnnotationLayer.tsx`

**Files:**
- Create: `app/learn/[id]/components/AnnotationLayer.tsx`

- [ ] **Step 1: Create the annotation rendering overlay**

```typescript
// app/learn/[id]/components/AnnotationLayer.tsx

"use client";

import { AnimatePresence, motion } from "framer-motion";
import { MessageSquare, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { Annotation } from "@/hooks/useAnnotations";

interface AnnotationLayerProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  annotations: Annotation[];
  onRemove: (id: string) => void;
  onUpdateNote: (id: string, content: string) => void;
}

/**
 * Find and highlight text ranges in a container based on text-content anchoring.
 * Returns the Range for each matched annotation.
 */
function findAnnotationRanges(
  container: HTMLElement,
  annotations: Annotation[],
): Map<string, Range> {
  const ranges = new Map<string, Range>();
  const text = container.textContent ?? "";

  for (const annotation of annotations) {
    const { textContent, startOffset, endOffset } = annotation.anchor;
    const contextIndex = text.indexOf(textContent);
    if (contextIndex === -1) continue;

    const absoluteStart = contextIndex + startOffset;
    const absoluteEnd = contextIndex + endOffset;

    // Walk DOM tree to find the text nodes at these absolute positions
    const range = document.createRange();
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    let currentOffset = 0;
    let startSet = false;

    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      const nodeLength = node.length;

      if (!startSet && currentOffset + nodeLength > absoluteStart) {
        range.setStart(node, absoluteStart - currentOffset);
        startSet = true;
      }

      if (startSet && currentOffset + nodeLength >= absoluteEnd) {
        range.setEnd(node, absoluteEnd - currentOffset);
        ranges.set(annotation.id, range);
        break;
      }

      currentOffset += nodeLength;
    }
  }

  return ranges;
}

export function AnnotationLayer({
  containerRef,
  annotations,
  onRemove,
  onUpdateNote,
}: AnnotationLayerProps) {
  const [highlights, setHighlights] = useState<
    Array<{
      id: string;
      rects: DOMRect[];
      color: string;
      type: "highlight" | "note";
      noteContent?: string;
    }>
  >([]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);

  // Recalculate highlight positions
  useEffect(() => {
    if (!containerRef.current || annotations.length === 0) {
      setHighlights([]);
      return;
    }

    const ranges = findAnnotationRanges(containerRef.current, annotations);
    const containerRect = containerRef.current.getBoundingClientRect();

    const newHighlights = annotations
      .filter((a) => ranges.has(a.id))
      .map((a) => {
        const range = ranges.get(a.id)!;
        const rects = Array.from(range.getClientRects()).map((r) => ({
          ...r.toJSON(),
          top: r.top - containerRect.top,
          left: r.left - containerRect.left,
        })) as DOMRect[];

        return {
          id: a.id,
          rects,
          color: a.color ?? "#fef08a",
          type: a.type,
          noteContent: a.noteContent,
        };
      });

    setHighlights(newHighlights);
  }, [containerRef, annotations]);

  if (highlights.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none">
      {highlights.map((h) => (
        <div key={h.id}>
          {/* Highlight rectangles */}
          {h.rects.map((rect, i) => (
            <div
              key={`${h.id}-${i}`}
              className="absolute pointer-events-auto cursor-pointer"
              style={{
                top: rect.top,
                left: rect.left,
                width: rect.width,
                height: rect.height,
                backgroundColor: h.color,
                opacity: 0.35,
                borderRadius: 2,
              }}
              onClick={() => {
                if (h.type === "note") {
                  setActiveNoteId(activeNoteId === h.id ? null : h.id);
                }
              }}
            />
          ))}

          {/* Note icon */}
          {h.type === "note" && h.rects.length > 0 && (
            <button
              type="button"
              className="absolute pointer-events-auto w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-sm hover:scale-110 transition-transform"
              style={{
                top: h.rects[0].top - 4,
                left: h.rects[0].left + h.rects[0].width + 4,
              }}
              onClick={() => setActiveNoteId(activeNoteId === h.id ? null : h.id)}
            >
              <MessageSquare className="w-3 h-3" />
            </button>
          )}

          {/* Note popover */}
          <AnimatePresence>
            {activeNoteId === h.id && h.type === "note" && h.rects.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="absolute pointer-events-auto z-40 bg-white rounded-lg shadow-lg border border-zinc-200 p-3 max-w-[280px]"
                style={{
                  top: h.rects[0].top + h.rects[0].height + 8,
                  left: h.rects[0].left,
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-zinc-500">笔记</span>
                  <button
                    type="button"
                    onClick={() => onRemove(h.id)}
                    className="text-zinc-400 hover:text-red-500 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-sm text-zinc-700 leading-relaxed">{h.noteContent}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/learn/[id]/components/AnnotationLayer.tsx
git commit -m "feat(learn): AnnotationLayer for highlight/note rendering"
```

---

### Task 13: Create `SectionReader.tsx` — main content renderer

**Files:**
- Create: `app/learn/[id]/components/SectionReader.tsx`
- Delete: `app/learn/[id]/components/ChapterContent.tsx`

- [ ] **Step 1: Create the section reader component**

```typescript
// app/learn/[id]/components/SectionReader.tsx

"use client";

import { motion } from "framer-motion";
import { AlertCircle, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { StreamdownMessage } from "@/components/chat/StreamdownMessage";
import type { Annotation } from "@/hooks/useAnnotations";
import { useAnnotations } from "@/hooks/useAnnotations";
import type { SectionState } from "@/hooks/useChapterSections";
import { cn } from "@/lib/utils";
import { useLearnStore } from "@/stores/learn";
import { AnnotationLayer } from "./AnnotationLayer";
import { TextSelectionToolbar } from "./TextSelectionToolbar";

interface SectionDoc {
  id: string;
  title: string | null;
  content: string | null;
  outlineNodeId: string | null;
  metadata: { annotations?: Annotation[] } | null;
}

interface SectionReaderProps {
  courseId: string;
  sections: Map<number, SectionState>;
  generateSection: (index: number) => void;
  sectionDocs: SectionDoc[];
}

function NoteInputDialog({
  onSubmit,
  onCancel,
}: {
  onSubmit: (text: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-xl shadow-xl p-4 w-80"
      >
        <h3 className="text-sm font-semibold text-zinc-900 mb-2">添加笔记</h3>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="写下你的想法..."
          rows={3}
          className="w-full border border-zinc-200 rounded-lg p-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          autoFocus
        />
        <div className="flex justify-end gap-2 mt-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-100 rounded-lg"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => text.trim() && onSubmit(text.trim())}
            disabled={!text.trim()}
            className="px-3 py-1.5 text-xs bg-zinc-900 text-white rounded-lg disabled:opacity-50"
          >
            保存
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function SectionBlock({
  sectionIndex,
  chapterIndex,
  sectionTitle,
  state,
  sectionDoc,
  generateSection,
}: {
  sectionIndex: number;
  chapterIndex: number;
  sectionTitle: string;
  state: SectionState;
  sectionDoc: SectionDoc | undefined;
  generateSection: (index: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pendingNoteAnchor, setPendingNoteAnchor] = useState<Annotation["anchor"] | null>(null);

  const { annotations, addHighlight, addNote, removeAnnotation, updateNote } = useAnnotations({
    documentId: sectionDoc?.id,
    initialAnnotations: sectionDoc?.metadata?.annotations ?? [],
  });

  const isComplete = state.status === "complete";

  const handleNote = useCallback((anchor: Annotation["anchor"]) => {
    setPendingNoteAnchor(anchor);
  }, []);

  const anchorId = `section-${chapterIndex + 1}-${sectionIndex + 1}`;

  return (
    <div id={anchorId} className="relative">
      {/* Section divider (not for first section) */}
      {sectionIndex > 0 && (
        <hr className="border-t border-zinc-100 my-8" />
      )}

      {/* Section content */}
      <div ref={containerRef} className="relative">
        {state.status === "idle" && (
          <div className="flex flex-col items-center py-12 text-zinc-400">
            <button
              type="button"
              onClick={() => generateSection(sectionIndex)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-sm text-zinc-600 transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              生成「{sectionTitle}」
            </button>
          </div>
        )}

        {state.status === "generating" && state.content.length === 0 && (
          <div className="flex items-center gap-2 py-8 text-zinc-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">正在生成「{sectionTitle}」...</span>
          </div>
        )}

        {(state.status === "generating" || state.status === "complete") && state.content && (
          <StreamdownMessage
            content={state.content}
            isStreaming={state.status === "generating"}
          />
        )}

        {state.status === "error" && (
          <div className="flex items-center gap-3 py-6 px-4 bg-red-50 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-red-700">{state.error ?? "生成失败"}</p>
            </div>
            <button
              type="button"
              onClick={() => generateSection(sectionIndex)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white border border-red-200 rounded-lg text-red-600 hover:bg-red-50"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              重试
            </button>
          </div>
        )}

        {/* Annotation layer — only for completed sections */}
        {isComplete && (
          <>
            <AnnotationLayer
              containerRef={containerRef}
              annotations={annotations}
              onRemove={removeAnnotation}
              onUpdateNote={updateNote}
            />
            <TextSelectionToolbar
              containerRef={containerRef}
              onHighlight={addHighlight}
              onNote={handleNote}
            />
          </>
        )}
      </div>

      {/* Note input dialog */}
      {pendingNoteAnchor && (
        <NoteInputDialog
          onSubmit={(text) => {
            addNote(pendingNoteAnchor, text);
            setPendingNoteAnchor(null);
          }}
          onCancel={() => setPendingNoteAnchor(null)}
        />
      )}
    </div>
  );
}

export function SectionReader({
  courseId,
  sections,
  generateSection,
  sectionDocs,
}: SectionReaderProps) {
  const { currentChapterIndex, chapters, isZenMode, setCurrentSectionIndex } = useLearnStore();
  const currentChapter = chapters[currentChapterIndex];
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Intersection Observer to track visible section
  useEffect(() => {
    if (!scrollContainerRef.current || !currentChapter) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = entry.target.id; // "section-1-1" format
            const parts = id.split("-");
            if (parts.length === 3) {
              const secIdx = parseInt(parts[2], 10) - 1;
              if (!Number.isNaN(secIdx)) {
                setCurrentSectionIndex(secIdx);
              }
            }
          }
        }
      },
      {
        root: scrollContainerRef.current,
        rootMargin: "-20% 0px -60% 0px",
        threshold: 0,
      },
    );

    // Observe all section anchors
    const sectionCount = currentChapter.sections.length;
    for (let i = 0; i < sectionCount; i++) {
      const el = document.getElementById(
        `section-${currentChapterIndex + 1}-${i + 1}`,
      );
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [currentChapterIndex, currentChapter, setCurrentSectionIndex]);

  // Scroll to section triggered from sidebar
  const scrollToSection = useCallback((sectionIndex: number) => {
    const el = document.getElementById(
      `section-${currentChapterIndex + 1}-${sectionIndex + 1}`,
    );
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [currentChapterIndex]);

  if (!currentChapter) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-400">
        <p className="text-sm">暂无内容</p>
      </div>
    );
  }

  return (
    <div
      ref={scrollContainerRef}
      className={cn(
        "h-full overflow-y-auto",
        isZenMode ? "max-w-3xl mx-auto px-8 py-12" : "p-6 md:p-8 lg:p-10",
      )}
    >
      {/* Chapter header */}
      {!isZenMode && (
        <div className="mb-6 pb-4 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-2 text-xs text-[var(--color-accent)] mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>第 {currentChapterIndex + 1} 章</span>
          </div>
          <h2 className="text-xl font-semibold text-zinc-900">{currentChapter.title}</h2>
          {currentChapter.description && (
            <p className="mt-1 text-sm text-zinc-500">{currentChapter.description}</p>
          )}
        </div>
      )}

      {/* Sections */}
      {currentChapter.sections.map((sec, secIdx) => {
        const state = sections.get(secIdx) ?? { content: "", status: "idle" as const };
        const nodeId = sec.nodeId;
        const sectionDoc = sectionDocs.find((d) => d.outlineNodeId === nodeId);

        return (
          <SectionBlock
            key={nodeId}
            sectionIndex={secIdx}
            chapterIndex={currentChapterIndex}
            sectionTitle={sec.title}
            state={state}
            sectionDoc={sectionDoc}
            generateSection={generateSection}
          />
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Delete old ChapterContent**

```bash
rm app/learn/[id]/components/ChapterContent.tsx
```

- [ ] **Step 3: Commit**

```bash
git add app/learn/[id]/components/SectionReader.tsx
git rm app/learn/[id]/components/ChapterContent.tsx
git commit -m "feat(learn): SectionReader with StreamdownMessage + annotations"
```

---

## Chunk 5: Page Layer (Server + Client + Sidebar)

### Task 14: Rewrite `app/learn/[id]/page.tsx` for section data

**Files:**
- Modify: `app/learn/[id]/page.tsx:1-103`

- [ ] **Step 1: Replace the entire page component**

```typescript
/**
 * Learn Page - Server Component
 *
 * Fetches course session data with section-level structure and passes to LearnClient.
 */

import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { courseSessions, db, documents } from "@/db";
import { auth } from "@/lib/auth";

import { LearnClient } from "./LearnClient";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ chapter?: string }>;
}

// OutlineData types matching stores/interview.ts
interface SectionData {
  title: string;
  description: string;
}

interface ChapterData {
  title: string;
  description: string;
  sections: SectionData[];
}

interface OutlineData {
  title?: string;
  description?: string;
  chapters?: ChapterData[];
}

export default async function LearnPage({ params, searchParams }: PageProps) {
  const { id: sessionId } = await params;
  const { chapter } = await searchParams;

  // Verify user is authenticated
  const session = await auth();
  if (!session?.user?.id) {
    notFound();
  }

  // Fetch course session
  const [courseSession] = await db
    .select({
      id: courseSessions.id,
      title: courseSessions.title,
      outlineData: courseSessions.outlineData,
    })
    .from(courseSessions)
    .where(eq(courseSessions.id, sessionId))
    .limit(1);

  if (!courseSession) {
    notFound();
  }

  // Extract structured chapters with sections from outlineData
  const outlineData = courseSession.outlineData as OutlineData | null;
  const chapters = (outlineData?.chapters ?? []).map((ch, chIdx) => ({
    title: ch.title,
    description: ch.description ?? "",
    sections: (ch.sections ?? []).map((sec, secIdx) => ({
      title: sec.title,
      description: sec.description ?? "",
      nodeId: `section-${chIdx + 1}-${secIdx + 1}`,
    })),
  }));

  // Load all section documents for this course
  const rawDocs = await db
    .select({
      id: documents.id,
      title: documents.title,
      content: documents.content,
      outlineNodeId: documents.outlineNodeId,
      metadata: documents.metadata,
    })
    .from(documents)
    .where(and(eq(documents.courseId, sessionId), eq(documents.type, "course_section")));

  // Decode Buffer to string before RSC → Client boundary
  const sectionDocs = rawDocs.map((doc) => ({
    id: doc.id,
    title: doc.title,
    content: doc.content ? Buffer.from(doc.content).toString("utf-8") : null,
    outlineNodeId: doc.outlineNodeId,
    metadata: doc.metadata as { annotations?: Array<{
      id: string;
      type: "highlight" | "note";
      anchor: { textContent: string; startOffset: number; endOffset: number };
      color?: string;
      noteContent?: string;
      createdAt: string;
    }> } | null,
  }));

  // Calculate initial chapter index
  const chapterNum = chapter ? parseInt(chapter, 10) : 1;
  const initialChapterIndex = Number.isNaN(chapterNum) ? 0 : Math.max(0, chapterNum - 1);

  // Compute initial completed sections (sections with non-null content)
  const initialCompletedSections = sectionDocs
    .filter((d) => d.content !== null && d.outlineNodeId !== null)
    .map((d) => d.outlineNodeId!);

  return (
    <LearnClient
      sessionId={sessionId}
      courseTitle={courseSession.title ?? "Untitled Course"}
      chapters={chapters}
      sectionDocs={sectionDocs}
      initialChapterIndex={initialChapterIndex}
      initialCompletedSections={initialCompletedSections}
    />
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/learn/[id]/page.tsx
git commit -m "refactor(learn): page.tsx for section-level data extraction"
```

---

### Task 15: Rewrite `LearnClient.tsx`

**Files:**
- Modify: `app/learn/[id]/LearnClient.tsx:1-173`

- [ ] **Step 1: Replace the entire client component**

```typescript
// app/learn/[id]/LearnClient.tsx

"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo } from "react";
import type { Annotation } from "@/hooks/useAnnotations";
import { useChapterSections } from "@/hooks/useChapterSections";
import type { ChapterOutline, SectionOutline } from "@/stores/learn";
import { useLearnStore } from "@/stores/learn";

import { LearnChat } from "./components/LearnChat";
import { LearnSidebar } from "./components/LearnSidebar";
import { SectionReader } from "./components/SectionReader";
import { ZenModeToggle } from "./components/ZenModeToggle";

// Props types matching page.tsx data
export interface SectionDoc {
  id: string;
  title: string | null;
  content: string | null;
  outlineNodeId: string | null;
  metadata: { annotations?: Annotation[] } | null;
}

export interface LearnClientProps {
  sessionId: string;
  courseTitle: string;
  chapters: ChapterOutline[];
  sectionDocs: SectionDoc[];
  initialChapterIndex: number;
  initialCompletedSections: string[];
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
  sectionDocs,
  initialChapterIndex,
  initialCompletedSections,
}: LearnClientProps) {
  const setChapters = useLearnStore((s) => s.setChapters);
  const setCurrentChapterIndex = useLearnStore((s) => s.setCurrentChapterIndex);
  const markSectionComplete = useLearnStore((s) => s.markSectionComplete);
  const toggleChapterExpanded = useLearnStore((s) => s.toggleChapterExpanded);
  const isZenMode = useLearnStore((s) => s.isZenMode);
  const currentChapterIndex = useLearnStore((s) => s.currentChapterIndex);

  // Initialize store on mount
  useEffect(() => {
    setChapters(chapters);
    setCurrentChapterIndex(initialChapterIndex);

    // Initialize completed sections
    for (const nodeId of initialCompletedSections) {
      markSectionComplete(nodeId);
    }

    // Expand initial chapter in sidebar
    toggleChapterExpanded(initialChapterIndex);
  }, []); // Run once on mount

  const currentChapter = chapters[currentChapterIndex];

  // Build initialContent map for the current chapter's sections
  const initialContent = useMemo(() => {
    const map = new Map<string, { content: string; documentId: string }>();
    for (const doc of sectionDocs) {
      if (doc.content && doc.outlineNodeId) {
        map.set(doc.outlineNodeId, { content: doc.content, documentId: doc.id });
      }
    }
    return map;
  }, [sectionDocs]);

  // Section generation hook
  const { sections, currentGenerating, generateSection } = useChapterSections({
    courseId: sessionId,
    chapterIndex: currentChapterIndex,
    sectionCount: currentChapter?.sections.length ?? 0,
    initialContent,
  });

  // Mark sections complete as they finish generating
  useEffect(() => {
    for (const [secIdx, state] of sections) {
      if (state.status === "complete") {
        const nodeId = `section-${currentChapterIndex + 1}-${secIdx + 1}`;
        markSectionComplete(nodeId);
      }
    }
  }, [sections, currentChapterIndex, markSectionComplete]);

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
          {!isZenMode && currentChapter && (
            <motion.header
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)] bg-white"
            >
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-[var(--color-accent)] bg-[var(--color-accent-light)] px-2 py-1 rounded-full">
                  第 {currentChapterIndex + 1} 章
                </span>
                <h1 className="font-semibold text-zinc-900 truncate max-w-md">
                  {currentChapter.title}
                </h1>
              </div>
              <div className="hidden md:flex items-center gap-2 text-sm text-zinc-500">
                <span className="truncate max-w-[200px]">{courseTitle}</span>
              </div>
            </motion.header>
          )}
        </AnimatePresence>

        {/* Section content (streaming generation + read-only) */}
        <div className="flex-1 overflow-hidden bg-[var(--color-bg)]">
          <SectionReader
            courseId={sessionId}
            sections={sections}
            generateSection={generateSection}
            sectionDocs={sectionDocs}
          />
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

- [ ] **Step 2: Commit**

```bash
git add app/learn/[id]/LearnClient.tsx
git commit -m "refactor(learn): LearnClient with section-level props and hooks"
```

---

### Task 16: Rewrite `LearnSidebar.tsx` + `ChapterList.tsx` for two-level navigation

**Files:**
- Modify: `app/learn/[id]/components/LearnSidebar.tsx:1-141`
- Modify: `app/learn/[id]/components/ChapterList.tsx:1-146`

- [ ] **Step 1: Update LearnSidebar for section-level progress**

Replace `LearnSidebar.tsx`:

```typescript
"use client";

import { motion } from "framer-motion";
import { ArrowLeft, BookOpen, Clock, Sparkles, Trophy } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useLearnStore } from "@/stores/learn";
import { ChapterList } from "./ChapterList";

interface LearnSidebarProps {
  courseTitle: string;
  width: number;
}

const contentVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

export function LearnSidebar({ courseTitle, width }: LearnSidebarProps) {
  const router = useRouter();
  const { chapters, completedSections } = useLearnStore();

  // Count total sections across all chapters
  const totalSections = chapters.reduce((sum, ch) => sum + ch.sections.length, 0);
  const completedCount = completedSections.size;
  const progress = totalSections > 0 ? Math.round((completedCount / totalSections) * 100) : 0;

  return (
    <div
      className="flex flex-col h-full border-r border-[var(--color-border)] bg-white"
      style={{ width }}
    >
      <motion.div
        variants={contentVariants}
        initial="hidden"
        animate="visible"
        className="flex flex-col h-full"
      >
        {/* Header */}
        <motion.div
          variants={itemVariants}
          className="flex items-center gap-3 px-5 py-5 border-b border-[var(--color-border)]"
        >
          <button
            type="button"
            onClick={() => router.push("/")}
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-xl",
              "bg-[var(--color-bg-secondary)] text-zinc-600",
              "hover:bg-[var(--color-accent-light)] hover:text-[var(--color-accent)]",
              "transition-all duration-200",
            )}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-zinc-900 truncate">{courseTitle}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <BookOpen className="w-3 h-3 text-zinc-400" />
              <p className="text-xs text-zinc-500">
                {completedCount} / {totalSections} 节完成
              </p>
            </div>
          </div>
        </motion.div>

        {/* Progress */}
        <motion.div
          variants={itemVariants}
          className="px-5 py-5 border-b border-[var(--color-border)]"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[var(--color-accent-light)] flex items-center justify-center">
                <Trophy className="w-4 h-4 text-[var(--color-accent)]" />
              </div>
              <span className="text-sm font-medium text-zinc-700">学习进度</span>
            </div>
            <span className="text-lg font-bold text-[var(--color-accent)]">{progress}%</span>
          </div>

          <div className="relative h-2 bg-[var(--color-bg-secondary)] rounded-full overflow-hidden">
            <motion.div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent-hover)] rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
            {progress > 0 && (
              <motion.div
                className="absolute inset-y-0 w-8 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                animate={{ x: ["-100%", "400%"] }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 3, ease: "linear" }}
              />
            )}
          </div>

          <div className="flex items-center gap-4 mt-4">
            <div className="flex items-center gap-1.5 text-xs text-zinc-500">
              <Clock className="w-3.5 h-3.5" />
              <span>预计 {totalSections * 10} 分钟</span>
            </div>
            {completedCount > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-[var(--color-accent)]">
                <Sparkles className="w-3.5 h-3.5" />
                <span>已完成 {completedCount} 节</span>
              </div>
            )}
          </div>
        </motion.div>

        {/* Chapter list header */}
        <motion.div variants={itemVariants} className="px-5 py-3">
          <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">课程大纲</h2>
        </motion.div>

        {/* Chapter > Section list */}
        <div className="flex-1 overflow-y-auto px-3 pb-4">
          <ChapterList />
        </div>
      </motion.div>
    </div>
  );
}
```

- [ ] **Step 2: Rewrite ChapterList for two-level navigation**

Replace `ChapterList.tsx`:

```typescript
"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, ChevronRight, Circle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLearnStore } from "@/stores/learn";

export function ChapterList() {
  const chapters = useLearnStore((s) => s.chapters);
  const currentChapterIndex = useLearnStore((s) => s.currentChapterIndex);
  const currentSectionIndex = useLearnStore((s) => s.currentSectionIndex);
  const completedSections = useLearnStore((s) => s.completedSections);
  const expandedChapters = useLearnStore((s) => s.expandedChapters);
  const setCurrentChapterIndex = useLearnStore((s) => s.setCurrentChapterIndex);
  const toggleChapterExpanded = useLearnStore((s) => s.toggleChapterExpanded);

  if (chapters.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
        <Circle className="w-12 h-12 mb-3 opacity-30" />
        <p className="text-sm">暂无章节内容</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {chapters.map((chapter, chIdx) => {
        const isExpanded = expandedChapters.has(chIdx);
        const isCurrent = chIdx === currentChapterIndex;
        const chapterSectionCount = chapter.sections.length;
        const chapterCompletedCount = chapter.sections.filter((sec) =>
          completedSections.has(sec.nodeId),
        ).length;
        const isChapterComplete = chapterCompletedCount === chapterSectionCount;

        return (
          <div key={`ch-${chIdx}`}>
            {/* Chapter header */}
            <button
              type="button"
              onClick={() => {
                toggleChapterExpanded(chIdx);
                if (chIdx !== currentChapterIndex) {
                  setCurrentChapterIndex(chIdx);
                }
              }}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-left transition-all duration-200",
                isCurrent
                  ? "bg-[var(--color-accent-light)] text-[var(--color-accent)]"
                  : "text-zinc-700 hover:bg-zinc-50",
              )}
            >
              {/* Expand/collapse icon */}
              <span className="w-4 h-4 shrink-0 flex items-center justify-center">
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </span>

              {/* Chapter number */}
              <span
                className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold shrink-0",
                  isChapterComplete
                    ? "bg-[var(--color-accent)] text-white"
                    : isCurrent
                      ? "bg-[var(--color-accent)] text-white"
                      : "bg-zinc-100 text-zinc-500",
                )}
              >
                {isChapterComplete ? <Check className="w-3.5 h-3.5" /> : chIdx + 1}
              </span>

              {/* Title + progress */}
              <div className="flex-1 min-w-0">
                <span className={cn("block text-sm truncate", isCurrent && "font-semibold")}>
                  {chapter.title}
                </span>
                <span className="text-xs text-zinc-400">
                  {chapterCompletedCount}/{chapterSectionCount} 节
                </span>
              </div>
            </button>

            {/* Section list (expandable) */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="pl-7 pr-2 py-1 space-y-0.5">
                    {chapter.sections.map((sec, secIdx) => {
                      const isCompleted = completedSections.has(sec.nodeId);
                      const isCurrentSection =
                        isCurrent && secIdx === currentSectionIndex;

                      return (
                        <button
                          key={sec.nodeId}
                          type="button"
                          onClick={() => {
                            if (chIdx !== currentChapterIndex) {
                              setCurrentChapterIndex(chIdx);
                            }
                            // Scroll to section anchor
                            const el = document.getElementById(sec.nodeId);
                            el?.scrollIntoView({ behavior: "smooth", block: "start" });
                          }}
                          className={cn(
                            "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-xs transition-colors",
                            isCurrentSection
                              ? "bg-[var(--color-accent-light)] text-[var(--color-accent)] font-medium"
                              : "text-zinc-600 hover:bg-zinc-50",
                          )}
                        >
                          {/* Status dot */}
                          <span
                            className={cn(
                              "w-2 h-2 rounded-full shrink-0",
                              isCompleted
                                ? "bg-[var(--color-accent)]"
                                : "border border-zinc-300",
                            )}
                          />
                          <span className="truncate">{sec.title}</span>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/learn/[id]/components/LearnSidebar.tsx app/learn/[id]/components/ChapterList.tsx
git commit -m "feat(learn): two-level chapter > section sidebar navigation"
```

---

## Chunk 6: TypeScript Verification & Final Cleanup

### Task 17: Fix TypeScript compilation errors and verify build

**Files:**
- Any files with remaining type errors

- [ ] **Step 1: Run TypeScript check**

Run: `bunx tsc --noEmit 2>&1 | head -80`

- [ ] **Step 2: Fix any remaining type errors**

Common expected issues:
- `LearnChat.tsx` may reference old `chapters` type from store — the new store exports `ChapterOutline` (not `Chapter` with `id`/`nodeId`). Update `LearnChat.tsx` if it references chapter shape directly.
- Any remaining references to `chapter.topics` elsewhere in the codebase.
- Imports of deleted files (`useChapterGeneration`, `ChapterContent`).

For each error, fix the minimum necessary code.

- [ ] **Step 3: Run the dev server**

Run: `bun dev` and verify no runtime errors on page load.

- [ ] **Step 4: Commit**

```bash
git add <files-with-fixes>
git commit -m "fix: resolve TypeScript compilation errors from section redesign"
```

---

### Task 18: Verify end-to-end flow

This is a manual verification task. Run through these scenarios:

- [ ] **Step 1: Interview flow** — Start a new interview, verify the outline generates with structured sections (not topic tags). Verify OutlinePanel shows section titles + descriptions.

- [ ] **Step 2: Placeholder creation** — After outline confirmation, check DB: `SELECT * FROM documents WHERE type = 'course_section'` should show placeholder rows with null content.

- [ ] **Step 3: Learning page load** — Navigate to `/learn/{courseId}`. Verify:
  - Sidebar shows two-level chapter > section navigation
  - First section starts generating automatically
  - Content streams as Markdown via StreamdownMessage
  - After completion, next section auto-generates (prefetch)

- [ ] **Step 4: Annotations** — After a section completes, select text. Verify:
  - Floating toolbar appears with Highlight and Note buttons
  - Highlighting works and persists
  - Note creation shows dialog and persists

- [ ] **Step 5: Navigation** — Click a section in sidebar. Verify scroll-to-anchor works. Verify Intersection Observer updates the current section highlight in sidebar.

- [ ] **Step 6: Commit final**

```bash
git add <files-with-fixes>
git commit -m "feat: section-based learning page redesign complete"
```
