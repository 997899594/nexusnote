# Learn Page Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create `/learn/[sessionId]` page with left sidebar (outline + chapters) and right editor, supporting zen mode for immersive learning.

**Architecture:** Server Component fetches course data, Client Component manages state (current chapter, zen mode). Reuse existing Editor component. Left sidebar similar to OutlinePanel from interview page.

**Tech Stack:** Next.js 16 App Router, React 19, Framer Motion, Tiptap, Zustand, Drizzle ORM

---

## Task 1: Create Learn Store

**Files:**
- Create: `stores/learn.ts`
- Modify: `stores/index.ts`

**Step 1: Create the store**

```typescript
// stores/learn.ts
/**
 * Learn Store - 课程学习状态管理
 */

import { create } from "zustand";

interface Chapter {
  id: string;
  title: string;
  nodeId: string;
}

interface LearnStore {
  // 当前章节索引
  currentChapterIndex: number;
  setCurrentChapterIndex: (index: number) => void;

  // 章节列表
  chapters: Chapter[];
  setChapters: (chapters: Chapter[]) => void;

  // 禅模式
  isZenMode: boolean;
  toggleZenMode: () => void;
  setZenMode: (isZen: boolean) => void;

  // 已完成章节
  completedChapters: Set<string>;
  markChapterComplete: (chapterId: string) => void;
}

export const useLearnStore = create<LearnStore>((set) => ({
  currentChapterIndex: 0,
  setCurrentChapterIndex: (index) => set({ currentChapterIndex: index }),

  chapters: [],
  setChapters: (chapters) => set({ chapters }),

  isZenMode: false,
  toggleZenMode: () => set((state) => ({ isZenMode: !state.isZenMode })),
  setZenMode: (isZen) => set({ isZenMode: isZen }),

  completedChapters: new Set(),
  markChapterComplete: (chapterId) =>
    set((state) => ({
      completedChapters: new Set([...state.completedChapters, chapterId]),
    })),
}));
```

**Step 2: Export from stores/index.ts**

Add to `stores/index.ts`:
```typescript
// Learn 相关
export { useLearnStore } from "./learn";
```

**Step 3: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add stores/learn.ts stores/index.ts
git commit -m "feat(store): add learn store for chapter and zen mode state"
```

---

## Task 2: Create Learn Page Entry (Server Component)

**Files:**
- Create: `app/learn/[id]/page.tsx`

**Step 1: Create the page**

```typescript
// app/learn/[id]/page.tsx
/**
 * Learn Page - 课程学习页面
 *
 * Server Component: 获取课程数据
 */

import { notFound } from "next/navigation";
import { LearnClient } from "./LearnClient";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { courseSessions, documents, eq, and } from "@/db";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ chapter?: string }>;
}

export default async function LearnPage({ params, searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    // 未登录可以查看，但进度不会保存
  }

  const { id: sessionId } = await params;
  const { chapter } = await searchParams;

  // 获取课程会话
  const courseSession = await db.query.courseSessions.findFirst({
    where: eq(courseSessions.id, sessionId),
  });

  if (!courseSession) {
    notFound();
  }

  // 获取所有章节文档
  const chapterDocs = await db
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.courseId, sessionId),
        eq(documents.type, "course_chapter")
      )
    )
    .orderBy(documents.outlineNodeId);

  // 从 outlineData 提取章节信息
  const outlineData = courseSession.outlineData as {
    chapters?: Array<{ title: string; description?: string }>;
  } | null;

  const chapters = (outlineData?.chapters || []).map((ch, idx) => ({
    id: chapterDocs[idx]?.id || `chapter-${idx + 1}`,
    title: ch.title,
    nodeId: chapterDocs[idx]?.outlineNodeId || `chapter-${idx + 1}`,
  }));

  // 计算当前章节索引
  const initialChapterIndex = chapter
    ? Math.max(0, parseInt(chapter, 10) - 1)
    : 0;

  return (
    <LearnClient
      sessionId={sessionId}
      courseTitle={courseSession.title || "未命名课程"}
      chapters={chapters}
      chapterDocs={chapterDocs}
      initialChapterIndex={initialChapterIndex}
      progress={courseSession.progress as { completedChapters?: string[] } | null}
    />
  );
}
```

**Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add app/learn/[id]/page.tsx
git commit -m "feat(learn): add learn page server component"
```

---

## Task 3: Create LearnClient Component

**Files:**
- Create: `app/learn/[id]/LearnClient.tsx`

**Step 1: Create the client component**

```typescript
// app/learn/[id]/LearnClient.tsx
"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { useLearnStore } from "@/stores";
import { LearnSidebar } from "./components/LearnSidebar";
import { ZenModeToggle } from "./components/ZenModeToggle";
import { LearnEditor } from "./components/LearnEditor";

interface Chapter {
  id: string;
  title: string;
  nodeId: string;
}

interface ChapterDoc {
  id: string;
  title: string | null;
  content: Buffer | null;
  outlineNodeId: string | null;
}

interface LearnClientProps {
  sessionId: string;
  courseTitle: string;
  chapters: Chapter[];
  chapterDocs: ChapterDoc[];
  initialChapterIndex: number;
  progress: { completedChapters?: string[] } | null;
}

export function LearnClient({
  sessionId,
  courseTitle,
  chapters,
  chapterDocs,
  initialChapterIndex,
  progress,
}: LearnClientProps) {
  const isZenMode = useLearnStore((s) => s.isZenMode);
  const setChapters = useLearnStore((s) => s.setChapters);
  const setCurrentChapterIndex = useLearnStore((s) => s.setCurrentChapterIndex);

  // 初始化
  useEffect(() => {
    setChapters(chapters);
    setCurrentChapterIndex(initialChapterIndex);
  }, [chapters, initialChapterIndex, setChapters, setCurrentChapterIndex]);

  const currentChapterIndex = useLearnStore((s) => s.currentChapterIndex);
  const currentDoc = chapterDocs[currentChapterIndex];

  return (
    <div className="flex h-screen bg-white">
      {/* 左侧边栏 */}
      <AnimatePresence mode="wait">
        {!isZenMode && (
          <motion.div
            initial={{ x: -280, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -280, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="w-[280px] flex-shrink-0 border-r border-zinc-200"
          >
            <LearnSidebar
              sessionId={sessionId}
              courseTitle={courseTitle}
              chapters={chapters}
              completedChapterIds={progress?.completedChapters || []}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 右侧内容区 */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* 顶栏 */}
        {!isZenMode && (
          <motion.header
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="h-14 flex items-center justify-between px-4 border-b border-zinc-100 bg-white"
          >
            <span className="text-sm text-zinc-500">
              {currentChapterIndex + 1} / {chapters.length}
            </span>
          </motion.header>
        )}

        {/* 编辑器区域 */}
        <div className="flex-1 overflow-auto">
          <LearnEditor
            documentId={currentDoc?.id}
            content={currentDoc?.content}
            isZenMode={isZenMode}
          />
        </div>

        {/* 禅模式切换 */}
        <ZenModeToggle />
      </div>
    </div>
  );
}
```

**Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: PASS (will have missing imports, fix in next tasks)

**Step 3: Commit**

```bash
git add app/learn/[id]/LearnClient.tsx
git commit -m "feat(learn): add LearnClient component with zen mode support"
```

---

## Task 4: Create LearnSidebar Component

**Files:**
- Create: `app/learn/[id]/components/LearnSidebar.tsx`

**Step 1: Create the sidebar**

```typescript
// app/learn/[id]/components/LearnSidebar.tsx
"use client";

import { motion } from "framer-motion";
import { ArrowLeft, BookOpen } from "lucide-react";
import { useRouter } from "next/navigation";
import { ChapterList } from "./ChapterList";

interface Chapter {
  id: string;
  title: string;
  nodeId: string;
}

interface LearnSidebarProps {
  sessionId: string;
  courseTitle: string;
  chapters: Chapter[];
  completedChapterIds: string[];
}

export function LearnSidebar({
  sessionId,
  courseTitle,
  chapters,
  completedChapterIds,
}: LearnSidebarProps) {
  const router = useRouter();

  const handleBack = () => {
    router.push("/");
  };

  const completedCount = completedChapterIds.length;
  const totalCount = chapters.length;
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-100">
        <button
          type="button"
          onClick={handleBack}
          className="p-2 hover:bg-zinc-100 rounded-lg transition-colors"
          aria-label="返回"
        >
          <ArrowLeft className="w-5 h-5 text-zinc-500" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold text-zinc-800 truncate">
            {courseTitle}
          </h1>
          <p className="text-xs text-zinc-400">
            {completedCount} / {totalCount} 章节
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="px-4 py-3 border-b border-zinc-100">
        <div className="flex items-center justify-between text-xs text-zinc-500 mb-2">
          <span>学习进度</span>
          <span>{progress}%</span>
        </div>
        <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="h-full bg-gradient-to-r from-purple-500 to-purple-600 rounded-full"
          />
        </div>
      </div>

      {/* Chapter List */}
      <div className="flex-1 overflow-y-auto">
        <ChapterList
          chapters={chapters}
          completedChapterIds={completedChapterIds}
        />
      </div>
    </div>
  );
}
```

**Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: PASS (ChapterList import will be resolved in next task)

**Step 3: Commit**

```bash
git add app/learn/[id]/components/LearnSidebar.tsx
git commit -m "feat(learn): add LearnSidebar with progress and back button"
```

---

## Task 5: Create ChapterList Component

**Files:**
- Create: `app/learn/[id]/components/ChapterList.tsx`

**Step 1: Create the chapter list**

```typescript
// app/learn/[id]/components/ChapterList.tsx
"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLearnStore } from "@/stores";

interface Chapter {
  id: string;
  title: string;
  nodeId: string;
}

interface ChapterListProps {
  chapters: Chapter[];
  completedChapterIds: string[];
}

export function ChapterList({ chapters, completedChapterIds }: ChapterListProps) {
  const currentChapterIndex = useLearnStore((s) => s.currentChapterIndex);
  const setCurrentChapterIndex = useLearnStore((s) => s.setCurrentChapterIndex);

  const handleChapterClick = (index: number) => {
    setCurrentChapterIndex(index);
  };

  return (
    <div className="p-2 space-y-1">
      <AnimatePresence mode="sync">
        {chapters.map((chapter, index) => {
          const isCompleted = completedChapterIds.includes(chapter.id);
          const isCurrent = index === currentChapterIndex;

          return (
            <motion.button
              key={chapter.id}
              type="button"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.03, duration: 0.2 }}
              onClick={() => handleChapterClick(index)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all",
                isCurrent
                  ? "bg-purple-50 text-purple-700"
                  : "text-zinc-600 hover:bg-zinc-50"
              )}
            >
              {/* 序号或完成标记 */}
              <div
                className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0",
                  isCompleted
                    ? "bg-green-500 text-white"
                    : isCurrent
                      ? "bg-purple-500 text-white"
                      : "bg-zinc-200 text-zinc-500"
                )}
              >
                {isCompleted ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  index + 1
                )}
              </div>

              {/* 标题 */}
              <span className={cn(
                "flex-1 text-sm truncate",
                isCurrent && "font-medium"
              )}>
                {chapter.title}
              </span>
            </motion.button>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
```

**Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add app/learn/[id]/components/ChapterList.tsx
git commit -m "feat(learn): add ChapterList with click navigation"
```

---

## Task 6: Create ZenModeToggle Component

**Files:**
- Create: `app/learn/[id]/components/ZenModeToggle.tsx`

**Step 1: Create the toggle**

```typescript
// app/learn/[id]/components/ZenModeToggle.tsx
"use client";

import { motion } from "framer-motion";
import { Minimize2 } from "lucide-react";
import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { useLearnStore } from "@/stores";

export function ZenModeToggle() {
  const isZenMode = useLearnStore((s) => s.isZenMode);
  const toggleZenMode = useLearnStore((s) => s.toggleZenMode);
  const setZenMode = useLearnStore((s) => s.setZenMode);

  // 监听键盘事件
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isZenMode) {
        setZenMode(false);
      }
      if (e.key === "f" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        // 只在没有其他修饰键时响应，避免和浏览器快捷键冲突
        const target = e.target as HTMLElement;
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
          return;
        }
        toggleZenMode();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isZenMode, setZenMode, toggleZenMode]);

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={toggleZenMode}
      className={cn(
        "fixed bottom-6 right-6 z-50",
        "w-10 h-10 rounded-full flex items-center justify-center",
        "bg-zinc-800 text-white shadow-lg",
        "hover:bg-zinc-700 transition-colors"
      )}
      aria-label={isZenMode ? "退出禅模式" : "进入禅模式"}
    >
      <Minimize2 className="w-5 h-5" />
    </motion.button>
  );
}
```

**Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add app/learn/[id]/components/ZenModeToggle.tsx
git commit -m "feat(learn): add ZenModeToggle with keyboard shortcuts"
```

---

## Task 7: Create LearnEditor Component

**Files:**
- Create: `app/learn/[id]/components/LearnEditor.tsx`

**Step 1: Create the editor wrapper**

```typescript
// app/learn/[id]/components/LearnEditor.tsx
"use client";

import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { Editor } from "@/components/editor";
import { useLearnStore } from "@/stores";

interface LearnEditorProps {
  documentId?: string;
  content: Buffer | null;
  isZenMode: boolean;
}

export function LearnEditor({ documentId, content, isZenMode }: LearnEditorProps) {
  const [editorContent, setEditorContent] = useState("");
  const [loading, setLoading] = useState(true);
  const currentChapterIndex = useLearnStore((s) => s.currentChapterIndex);

  // 当章节切换时加载内容
  useEffect(() => {
    setLoading(true);
    if (content) {
      try {
        const parsed = JSON.parse(content.toString());
        // Tiptap 期望的格式
        setEditorContent(JSON.stringify(parsed));
      } catch {
        setEditorContent("");
      }
    } else {
      setEditorContent("");
    }
    // 模拟加载延迟，让切换更明显
    const timer = setTimeout(() => setLoading(false), 100);
    return () => clearTimeout(timer);
  }, [content, currentChapterIndex]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <Loader2 className="w-6 h-6 text-purple-500" />
        </motion.div>
      </div>
    );
  }

  return (
    <motion.div
      key={documentId || currentChapterIndex}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className={isZenMode ? "max-w-3xl mx-auto px-8 py-12" : "p-6"}
    >
      <Editor
        content={editorContent}
        onChange={() => {
          // TODO: 自动保存
        }}
        placeholder="章节内容加载中..."
      />
    </motion.div>
  );
}
```

**Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add app/learn/[id]/components/LearnEditor.tsx
git commit -m "feat(learn): add LearnEditor wrapper for chapter content"
```

---

## Task 8: Update Navigation Links

**Files:**
- Modify: `components/interview/OutlinePanel.tsx:54-59`
- Modify: `components/home/RecentSectionServer.tsx:90`

**Step 1: Update OutlinePanel.tsx**

Find the `handleStartLearning` function and update:
```typescript
// Before
router.push(`/learn/${courseId}`);

// After (already correct, verify)
router.push(`/learn/${courseId}`);
```

**Step 2: Update RecentSectionServer.tsx**

Find line 90 and update:
```typescript
// Before
url: `/courses/${course.id}`,

// After
url: `/learn/${course.id}`,
```

**Step 3: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add components/interview/OutlinePanel.tsx components/home/RecentSectionServer.tsx
git commit -m "fix: update navigation links to use /learn route"
```

---

## Task 9: Final Verification

**Step 1: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 2: Run build**

Run: `SKIP_ENV_VALIDATION=true bun run build`
Expected: PASS

**Step 3: Manual test**

1. 访问 `/interview` 创建课程
2. 点击"开始学习"跳转到 `/learn/[sessionId]`
3. 验证左侧显示章节列表
4. 验证点击章节可切换内容
5. 按 `F` 进入禅模式
6. 按 `Esc` 退出禅模式
7. 首页点击课程卡片跳转到 `/learn/[sessionId]`

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat(learn): complete learn page with zen mode"
```

---

## Summary

| Task | Description |
|------|-------------|
| 1 | Create Learn Store |
| 2 | Create Learn Page Entry (Server Component) |
| 3 | Create LearnClient Component |
| 4 | Create LearnSidebar Component |
| 5 | Create ChapterList Component |
| 6 | Create ZenModeToggle Component |
| 7 | Create LearnEditor Component |
| 8 | Update Navigation Links |
| 9 | Final Verification |
