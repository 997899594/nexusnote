# 2026 RSC 完整现代化架构 - 实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 实现完整的 2026 年现代化架构，包括 Streamdown 流式 Markdown 渲染、Generative UI 工具调用、Tiptap 服务端转换，以及完整的 RSC Server + Client 分离模式。

**Architecture:** 采用分层架构：Server Components 负责数据获取和初始渲染，Client Components 负责交互和动画，Server Actions 实现 AI 流式响应和工具调用。

**Tech Stack:** Next.js 16, React 19, AI SDK v6, Streamdown + plugins, Tiptap 3.20, Framer Motion 12, TypeScript

---

## 前置准备

### 验证当前状态

**Files:** 检查现有依赖
- Read: `package.json`

**Step 1: 检查当前依赖版本**

确认以下版本：
- `next`: 16.1.6 ✓
- `react`: 19.2.4 ✓
- `ai`: 6.0.94 ✓
- `@ai-sdk/react`: 3.0.96 ✓
- `framer-motion`: 12.0.0 ✓
- `@tiptap/react`: 3.20.0 ✓

**Step 2: 验证项目可构建**

```bash
pnpm run build
```

Expected: 构建成功或仅有已知错误

---

## 阶段 1: 核心库升级与依赖安装

### Task 1: 安装 Streamdown 核心及所有插件

**Files:**
- Modify: `package.json`

**Step 1: 安装核心库**

```bash
pnpm add streamdown
```

Expected: 安装成功，无冲突

**Step 2: 安装所有插件**

```bash
pnpm add @streamdown/code @streamdown/math @streamdown/mermaid @streamdown/cjk
pnpm add katex
```

Expected: 安装成功

**Step 3: 验证安装**

```bash
grep -E "streamdown|katex" package.json
```

Expected输出:
```json
"streamdown": "^x.x.x",
"@streamdown/code": "^x.x.x",
"@streamdown/math": "^x.x.x",
"@streamdown/mermaid": "^x.x.x",
"@streamdown/cjk": "^x.x.x",
"katex": "^x.x.x"
```

**Step 4: 提交**

```bash
git add package.json pnpm-lock.yaml
git commit -m "feat: install streamdown and all plugins (code, math, mermaid, cjk)"
```

---

### Task 2: 配置 Tailwind CSS 加载 Streamdown 样式

**Files:**
- Modify: `app/globals.css`

**Step 1: 添加 Streamdown 样式源**

在文件顶部添加（在 `@import "tailwindcss";` 之后）：

```css
@import "tailwindcss";

/* Streamdown - 流式 Markdown 样式 */
@source "../node_modules/streamdown/dist/*.js";
```

**Step 2: 验证路径正确**

```bash
ls -la node_modules/streamdown/dist/*.js 2>/dev/null | head -5
```

Expected: 显示 streamdown 的 JS 文件

**Step 3: 构建验证**

```bash
pnpm run build
```

Expected: 构建成功，无 CSS 相关错误

**Step 4: 提交**

```bash
git add app/globals.css
git commit -m "style: add streamdown styles to globals.css"
```

---

## 阶段 2: 创建流式 Markdown 渲染组件

### Task 3: 创建 StreamdownMessage 组件

**Files:**
- Create: `components/chat/StreamdownMessage.tsx`

**Step 1: 创建组件文件**

```tsx
"use client";

/**
 * StreamdownMessage - 流式 Markdown 渲染组件
 *
 * 使用 Streamdown 替代 react-markdown，专为 AI 流式优化
 * 支持代码高亮、数学公式、Mermaid 图表、中文优化
 */

import { Streamdown } from "streamdown";
import { code } from "@streamdown/code";
import { math } from "@streamdown/math";
import { mermaid } from "@streamdown/mermaid";
import { cjk } from "@streamdown/cjk";
import "katex/dist/katex.min.css";

interface StreamdownMessageProps {
  content: string;
  isStreaming?: boolean;
  className?: string;
}

/**
 * 安全的 Streamdown 包装器
 * 降级策略：如果渲染失败，显示纯文本
 */
function SafeStreamdown({
  content,
  isStreaming,
  className,
}: {
  content: string;
  isStreaming?: boolean;
  className?: string;
}) {
  try {
    return (
      <Streamdown
        plugins={{ code, math, mermaid, cjk }}
        isAnimating={isStreaming}
        className={className}
      >
        {content}
      </Streamdown>
    );
  } catch (error) {
    // 降级到纯文本
    console.error("[Streamdown] Render error:", error);
    return (
      <pre className="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
        {content}
      </pre>
    );
  }
}

export function StreamdownMessage({
  content,
  isStreaming = false,
  className = "",
}: StreamdownMessageProps) {
  if (!content) return null;

  return (
    <div className={`prose prose-sm max-w-none dark:prose-invert ${className}`}>
      <SafeStreamdown content={content} isStreaming={isStreaming} />
    </div>
  );
}
```

**Step 2: 验证类型检查**

```bash
pnpm exec tsc --noEmit components/chat/StreamdownMessage.tsx
```

Expected: 无类型错误

**Step 3: 提交**

```bash
git add components/chat/StreamdownMessage.tsx
git commit -m "feat: add StreamdownMessage component with all plugins"
```

---

### Task 4: 更新 ChatMessage 组件使用 StreamdownMessage

**Files:**
- Modify: `components/chat/ChatMessage.tsx`

**Step 1: 修改导入**

将 `MarkdownRenderer` 替换为 `StreamdownMessage`：

```tsx
// 删除:
// import { MarkdownRenderer } from "@/components/shared/home";

// 添加:
import { StreamdownMessage } from "./StreamdownMessage";
```

**Step 2: 修改渲染逻辑**

找到渲染 Markdown 的部分（约第 38-42 行）：

```tsx
// 原代码:
{isUser ? (
  <p className="whitespace-pre-wrap">{content}</p>
) : (
  <MarkdownRenderer content={content} />
)}

// 改为:
{isUser ? (
  <p className="whitespace-pre-wrap">{content}</p>
) : (
  <StreamdownMessage content={content} />
)}
```

**Step 3: 验证类型检查**

```bash
pnpm exec tsc --noEmit components/chat/ChatMessage.tsx
```

Expected: 无类型错误

**Step 4: 提交**

```bash
git add components/chat/ChatMessage.tsx
git commit -m "refactor: use StreamdownMessage in ChatMessage"
```

---

### Task 5: 更新通用 MarkdownRenderer 使用 Streamdown

**Files:**
- Modify: `components/shared/home/MarkdownRenderer.tsx`

**Step 1: 重写组件使用 Streamdown**

```tsx
/**
 * Markdown Renderer - 使用 Streamdown 渲染 Markdown
 *
 * 2026 现代化方案：AI 返回 Markdown，前端渲染为富文本
 * 专为流式优化，支持代码高亮、数学公式、Mermaid 图表
 */

"use client";

import { Streamdown } from "streamdown";
import { code } from "@streamdown/code";
import { math } from "@streamdown/math";
import { mermaid } from "@streamdown/mermaid";
import { cjk } from "@streamdown/cjk";
import "katex/dist/katex.min.css";

interface MarkdownRendererProps {
  content: string;
  className?: string;
  isStreaming?: boolean;
}

export function MarkdownRenderer({
  content,
  className = "",
  isStreaming = false,
}: MarkdownRendererProps) {
  if (!content) return null;

  try {
    return (
      <div className={`prose prose-sm max-w-none dark:prose-invert ${className}`}>
        <Streamdown
          plugins={{ code, math, mermaid, cjk }}
          isAnimating={isStreaming}
        >
          {content}
        </Streamdown>
      </div>
    );
  } catch (error) {
    console.error("[MarkdownRenderer] Render error:", error);
    return <p className="whitespace-pre-wrap">{content}</p>;
  }
}
```

**Step 2: 验证类型检查**

```bash
pnpm exec tsc --noEmit components/shared/home/MarkdownRenderer.tsx
```

Expected: 无类型错误

**Step 3: 提交**

```bash
git add components/shared/home/MarkdownRenderer.tsx
git commit -m "refactor: rewrite MarkdownRenderer with Streamdown"
```

---

## 阶段 3: 创建 Tiptap 服务端转换工具

### Task 6: 创建 MarkdownManager 转换工具

**Files:**
- Create: `lib/tiptap/markdown.ts`

**Step 1: 创建转换工具文件**

```typescript
/**
 * Tiptap Markdown Server-Side Conversion
 *
 * 使用 MarkdownManager 进行无 DOM 的服务端 Markdown ↔ JSON 转换
 * 适用于 Server Components 预处理内容
 */

import { MarkdownManager } from "@tiptap/markdown";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";

// 配置扩展
const extensions = [
  StarterKit,
  Markdown,
  // 可添加更多扩展，如 Table, TaskList 等
];

// 创建单例 MarkdownManager
export const markdownManager = new MarkdownManager({ extensions });

/**
 * 将 Tiptap JSON 转换为 Markdown 字符串
 *
 * @param json - Tiptap JSON 对象
 * @returns Markdown 字符串
 *
 * @example
 * ```ts
 * const json = editor.getJSON();
 * const md = jsonToMarkdown(json);
 * ```
 */
export function jsonToMarkdown(json: unknown): string {
  try {
    return markdownManager.serialize(json);
  } catch (error) {
    console.error("[jsonToMarkdown] Conversion error:", error);
    // 返回空字符串作为降级
    return "";
  }
}

/**
 * 将 Markdown 字符串转换为 Tiptap JSON
 *
 * @param markdown - Markdown 字符串
 * @returns Tiptap JSON 对象
 *
 * @example
 * ```ts
 * const json = markdownToJson("# Hello\n\nWorld");
 * editor.setContent(json);
 * ```
 */
export function markdownToJson(markdown: string): unknown {
  try {
    return markdownManager.parse(markdown);
  } catch (error) {
    console.error("[markdownToJson] Conversion error:", error);
    // 返回空文档作为降级
    return {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: markdown }],
        },
      ],
    };
  }
}

/**
 * 类型安全的 Tiptap 文档结构
 */
export interface TiptapDocument {
  type: "doc";
  content: TiptapNode[];
}

export interface TiptapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  text?: string;
  marks?: TiptapMark[];
}

export interface TiptapMark {
  type: string;
  attrs?: Record<string, unknown>;
}
```

**Step 2: 验证类型检查**

```bash
pnpm exec tsc --noEmit lib/tiptap/markdown.ts
```

Expected: 无类型错误

**Step 3: 提交**

```bash
git add lib/tiptap/markdown.ts
git commit -m "feat: add Tiptap MarkdownManager conversion utilities"
```

---

## 阶段 4: RSC 重构 - 创建 Flashcards Client Component

### Task 7: 创建 flashcards-client.tsx

**Files:**
- Create: `app/flashcards/flashcards-client.tsx`

**Step 1: 创建 Client Component**

```tsx
"use client";

/**
 * Flashcards Client Component
 *
 * 处理所有客户端交互：闪卡翻转、状态管理、动画
 */

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  category?: string;
  difficulty?: "easy" | "medium" | "hard";
}

interface FlashcardsClientProps {
  initialCards: Flashcard[];
}

export function FlashcardsClient({ initialCards }: FlashcardsClientProps) {
  const [cards, setCards] = useState<Flashcard[]>(initialCards);
  const [flippedIds, setFlippedIds] = useState<Set<string>>(new Set());
  const [currentIndex, setCurrentIndex] = useState(0);

  const currentCard = cards[currentIndex];
  const isFlipped = flippedIds.has(currentCard?.id ?? "");

  const toggleFlip = () => {
    if (!currentCard) return;
    setFlippedIds((prev) => {
      const next = new Set(prev);
      if (next.has(currentCard.id)) {
        next.delete(currentCard.id);
      } else {
        next.add(currentCard.id);
      }
      return next;
    });
  };

  const goToNext = () => {
    setCurrentIndex((i) => Math.min(i + 1, cards.length - 1));
    setFlippedIds(new Set());
  };

  const goToPrev = () => {
    setCurrentIndex((i) => Math.max(i - 1, 0));
    setFlippedIds(new Set());
  };

  if (cards.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-zinc-500 mb-4">还没有闪卡</p>
          <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg">
            创建第一张闪卡
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="max-w-2xl mx-auto">
        {/* 进度指示 */}
        <div className="mb-6 flex items-center justify-between">
          <span className="text-sm text-zinc-500">
            {currentIndex + 1} / {cards.length}
          </span>
          <div className="flex gap-2">
            <button
              onClick={goToPrev}
              disabled={currentIndex === 0}
              className="px-3 py-1 text-sm bg-white border rounded-lg disabled:opacity-50"
            >
              上一张
            </button>
            <button
              onClick={goToNext}
              disabled={currentIndex === cards.length - 1}
              className="px-3 py-1 text-sm bg-white border rounded-lg disabled:opacity-50"
            >
              下一张
            </button>
          </div>
        </div>

        {/* 闪卡区域 */}
        <div className="relative h-80 perspective-1000">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${currentCard.id}-${isFlipped ? "back" : "front"}`}
              onClick={toggleFlip}
              className="absolute inset-0 cursor-pointer"
              initial={{ rotateY: 0 }}
              animate={{ rotateY: isFlipped ? 180 : 0 }}
              transition={{ duration: 0.6, type: "spring" }}
              style={{
                transformStyle: "preserve-3d",
                backfaceVisibility: "hidden",
              }}
            >
              <div className="absolute inset-0 bg-white rounded-2xl shadow-lg p-8 flex items-center justify-center">
                <p className="text-xl text-center font-medium">
                  {isFlipped ? currentCard.back : currentCard.front}
                </p>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* 操作提示 */}
        <p className="text-center text-sm text-zinc-400 mt-6">
          点击卡片查看答案
        </p>
      </div>
    </div>
  );
}
```

**Step 2: 验证类型检查**

```bash
pnpm exec tsc --noEmit app/flashcards/flashcards-client.tsx
```

Expected: 无类型错误

**Step 3: 提交**

```bash
git add app/flashcards/flashcards-client.tsx
git commit -m "feat: add FlashcardsClient component with flip animations"
```

---

### Task 8: 更新 flashcards page.tsx 使用真实数据

**Files:**
- Modify: `app/flashcards/page.tsx`

**Step 1: 添加数据获取逻辑**

```tsx
/**
 * Flashcards Page - 2026 RSC Architecture
 *
 * Server Component: 获取闪卡数据
 * Client Component: 翻转动画、状态管理
 */

import { Suspense } from "react";
import { FlashcardsClient, type Flashcard } from "./flashcards-client";

// 模拟数据获取（实际应从 DB 获取）
async function getFlashcards(): Promise<Flashcard[]> {
  // TODO: 替换为真实数据库查询
  return [
    {
      id: "1",
      front: "什么是 React Server Component?",
      back: "React Server Component 是在服务端渲染的组件，可以直接访问数据库和后端 API，减少客户端 JavaScript 体积。",
      category: "React",
      difficulty: "medium",
    },
    {
      id: "2",
      front: "useState 和 useReducer 的区别是什么?",
      back: "useState 适合简单的独立状态，useReducer 适合复杂的状态逻辑，特别是当下一个状态依赖于前一个状态时。",
      category: "React",
      difficulty: "easy",
    },
    {
      id: "3",
      front: "解释 TypeScript 中的泛型",
      back: "泛型允许我们在定义函数、接口或类时不指定具体类型，而是在使用时指定类型，提供更好的类型复用性和类型安全。",
      category: "TypeScript",
      difficulty: "hard",
    },
  ];
}

export default async function FlashcardsPage() {
  // Server Component 直接获取数据
  const initialCards = await getFlashcards();

  return (
    <Suspense fallback={<FlashcardsSkeleton />}>
      <FlashcardsClient initialCards={initialCards} />
    </Suspense>
  );
}

function FlashcardsSkeleton() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
```

**Step 2: 验证类型检查**

```bash
pnpm exec tsc --noEmit app/flashcards/page.tsx
```

Expected: 无类型错误

**Step 3: 提交**

```bash
git add app/flashcards/page.tsx
git commit -m "feat: add server-side data fetching to flashcards page"
```

---

## 阶段 5: 创建 Generative UI 系统

### Task 9: 创建 Generative UI Server Actions

**Files:**
- Create: `app/ai-ui/actions.tsx`

**Step 1: 创建 AI UI Actions**

```tsx
"use server";

/**
 * Generative UI Actions
 *
 * 使用 AI SDK v6 的 streamUI 实现流式生成 UI 组件
 * AI 可以决定调用工具并返回动态 React 组件
 */

import { streamUI } from "ai/rsc";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

// ============ UI 组件定义 ============

/**
 * 天气卡片组件示例
 */
interface WeatherCardProps {
  city: string;
  temp: number;
  condition: string;
}

function WeatherCard({ city, temp, condition }: WeatherCardProps) {
  return (
    <div className="p-4 border rounded-lg bg-blue-50 dark:bg-blue-900/20">
      <h2 className="text-lg font-bold">{city}</h2>
      <p className="text-3xl">{temp}°C</p>
      <p className="text-gray-500 dark:text-gray-400">{condition}</p>
    </div>
  );
}

/**
 * 闪卡预览组件
 */
interface FlashcardPreviewProps {
  front: string;
  back: string;
}

function FlashcardPreview({ front, back }: FlashcardPreviewProps) {
  return (
    <div className="border rounded-lg p-4 bg-card">
      <div className="font-bold mb-2">正面: {front}</div>
      <div className="text-muted-foreground">背面: {back}</div>
    </div>
  );
}

/**
 * 笔记搜索结果组件
 */
interface NotesSearchResultProps {
  query: string;
  results: Array<{ id: string; title: string; excerpt: string }>;
}

function NotesSearchResult({ query, results }: NotesSearchResultProps) {
  return (
    <div className="border rounded-lg p-4">
      <h3 className="font-semibold mb-2">搜索结果: "{query}"</h3>
      <ul className="space-y-2">
        {results.map((note) => (
          <li key={note.id} className="text-sm">
            <span className="font-medium">{note.title}</span>
            <p className="text-muted-foreground">{note.excerpt}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ============ AI Actions ============

/**
 * 生成 AI 响应（带 Generative UI）
 *
 * @param userInput - 用户输入
 * @returns 流式 UI 响应
 */
export async function generateAIResponse(userInput: string) {
  "use server";

  const result = await streamUI({
    model: openai("gpt-4o-mini"),
    prompt: userInput,
    // 普通文本的后备渲染
    text: ({ content }) => (
      <div className="prose dark:prose-invert max-w-none">
        {content}
      </div>
    ),
    // 向 AI 注册 UI 工具
    tools: {
      /**
       * 创建闪卡工具
       */
      createFlashcard: {
        description: "根据用户输入创建闪卡，包含正面和背面内容",
        parameters: z.object({
          front: z.string().describe("闪卡正面问题"),
          back: z.string().describe("闪卡背面答案"),
        }),
        generate: async function* ({ front, back }) {
          // 先显示加载状态
          yield <div className="animate-pulse">正在创建闪卡...</div>;
          // 返回最终 UI
          return <FlashcardPreview front={front} back={back} />;
        },
      },

      /**
       * 搜索笔记工具
       */
      searchNotes: {
        description: "搜索用户的笔记",
        parameters: z.object({
          query: z.string().describe("搜索关键词"),
        }),
        generate: async function* ({ query }) {
          yield <div className="animate-pulse">搜索中...</div>;
          // TODO: 实际搜索逻辑
          const results = [
            {
              id: "1",
              title: "React Hooks 学习笔记",
              excerpt: "useState 和 useEffect 是最常用的 Hooks...",
            },
          ];
          return <NotesSearchResult query={query} results={results} />;
        },
      },

      /**
       * 获取天气工具（示例）
       */
      getWeather: {
        description: "获取指定城市的天气信息",
        parameters: z.object({
          city: z.string().describe("城市名称，例如：北京、上海"),
        }),
        generate: async function* ({ city }) {
          yield <div className="animate-pulse">正在获取 {city} 的天气...</div>;
          // 模拟 API 调用
          // const weatherData = await fetchWeatherFromAPI(city);
          return <WeatherCard city={city} temp={25} condition="晴朗" />;
        },
      },
    },
  });

  return result.value;
}
```

**Step 2: 验证类型检查**

```bash
pnpm exec tsc --noEmit app/ai-ui/actions.tsx
```

Expected: 无类型错误

**Step 3: 提交**

```bash
git add app/ai-ui/actions.tsx
git commit -m "feat: add Generative UI actions with tool calling"
```

---

### Task 10: 创建 AI Provider

**Files:**
- Create: `app/ai-ui/AIProvider.tsx`

**Step 1: 创建 AI Provider 组件**

```tsx
"use client";

/**
 * AI Provider
 *
 * 使用 createAI 创建全局 AI 状态管理
 * 支持 Generative UI 的流式传输和消费
 */

import { createAI } from "ai/rsc";
import { generateAIResponse } from "./actions";

// AI 状态类型
export interface AIState {
  messages: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
}

// UI 状态类型
export interface UIState {
  // 存储流式生成的 UI 组件
  components: Array<{
    id: string;
    component: React.ReactNode;
  }>;
}

// 初始状态
const initialAIState: AIState = {
  messages: [],
};

const initialUIState: UIState = {
  components: [],
};

// 创建 AI 实例
export const AI = createAI({
  actions: {
    generateAIResponse,
  },
  initialAIState,
  initialUIState,
});

/**
 * 获取当前 AI 状态的 Hook
 * (需要在 Server Component 中使用)
 */
export async function getAIState() {
  return initialAIState;
}

/**
 * 获取当前 UI 状态的 Hook
 */
export async function getUIState() {
  return initialUIState;
}
```

**Step 2: 验证类型检查**

```bash
pnpm exec tsc --noEmit app/ai-ui/AIProvider.tsx
```

Expected: 无类型错误

**Step 3: 提交**

```bash
git add app/ai-ui/AIProvider.tsx
git commit -m "feat: add AI Provider for Generative UI state management"
```

---

### Task 11: 集成 AI Provider 到根布局

**Files:**
- Modify: `app/layout.tsx`

**Step 1: 导入 AI Provider**

在文件顶部添加导入：

```tsx
import { AI } from "./ai-ui/AIProvider";
```

**Step 2: 包装根布局**

找到 `<html>` 标签，用 AI Provider 包装：

```tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <AI>
      <html lang="zh-CN">
        {/* ... 现有内容 ... */}
      </html>
    </AI>
  );
}
```

**Step 3: 验证类型检查**

```bash
pnpm exec tsc --noEmit app/layout.tsx
```

Expected: 无类型错误

**Step 4: 构建验证**

```bash
pnpm run build
```

Expected: 构建成功

**Step 5: 提交**

```bash
git add app/layout.tsx
git commit -m "feat: integrate AI Provider into root layout"
```

---

## 阶段 6: 最终验证与测试

### Task 12: 完整构建验证

**Files:** 所有文件

**Step 1: 运行类型检查**

```bash
pnpm run typecheck
```

Expected: 无类型错误

**Step 2: 运行构建**

```bash
pnpm run build
```

Expected: 构建成功

**Step 3: 检查构建输出**

```bash
ls -la .next/static/chunks/
```

Expected: 看到新的 chunk 文件

**Step 4: 启动开发服务器验证**

```bash
pnpm dev
```

Expected: 服务器启动无错误

**Step 5: 手动测试检查清单**

访问以下页面并验证功能：

- [ ] `/demo` - 样式切换和动画正常
- [ ] `/interview` - 聊天界面正常
- [ ] `/flashcards` - 闪卡翻转动画正常
- [ ] `/chat` - AI 响应流式渲染正常
- [ ] 代码块语法高亮正常
- [ ] 数学公式渲染正常（如果 AI 返回）
- [ ] 中文文本无换行问题

**Step 6: 最终提交**

```bash
git add .
git commit -m "chore: final cleanup after RSC modernization"
```

---

## 阶段 7: 清理和优化

### Task 13: 移除未使用的 react-markdown

**Files:**
- Modify: `package.json`

**Step 1: 移除 react-markdown 依赖**

```bash
pnpm remove react-markdown remark-gfm
```

Expected: 移除成功

**Step 2: 检查是否还有其他引用**

```bash
grep -r "react-markdown" --include="*.ts" --include="*.tsx" .
grep -r "remark-gfm" --include="*.ts" --include="*.tsx" .
```

Expected: 无结果（或仅在 lock 文件中）

**Step 3: 构建验证**

```bash
pnpm run build
```

Expected: 构建成功

**Step 4: 提交**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: remove unused react-markdown and remark-gfm"
```

---

## 阶段 8: 文档更新

### Task 14: 更新项目文档

**Files:**
- Modify: `README.md` (如果存在)

**Step 1: 添加技术栈说明**

在 README 中添加：

```markdown
## 技术栈

- **框架**: Next.js 16 + React 19
- **AI**: Vercel AI SDK v6
- **Markdown**: Streamdown (流式优化)
- **编辑器**: Tiptap 3.20
- **动画**: Framer Motion 12
- **样式**: Tailwind CSS 4
```

**Step 2: 添加开发指南**

```markdown
## 开发指南

### RSC 架构

本项目采用 Server Components + Client Components 分层架构：

- **Server Components**: 数据获取、初始渲染
- **Client Components**: 交互、动画、状态管理

### 添加新页面

1. 创建 `app/your-page/page.tsx` (Server Component)
2. 创建 `app/your-page/your-page-client.tsx` (Client Component)
3. Server 获取数据，传递给 Client

### 流式 Markdown

使用 `StreamdownMessage` 组件渲染 AI 响应：

```tsx
import { StreamdownMessage } from "@/components/chat/StreamdownMessage";

<StreamdownMessage content={aiResponse} isStreaming={true} />
```
```

**Step 3: 提交**

```bash
git add README.md
git commit -m "docs: update README with new tech stack"
```

---

## 完成清单

在实施完成后，验证以下所有项：

### 依赖安装
- [ ] streamdown 安装
- [ ] @streamdown/code 安装
- [ ] @streamdown/math 安装
- [ ] @streamdown/mermaid 安装
- [ ] @streamdown/cjk 安装
- [ ] katex 安装

### 组件创建
- [ ] StreamdownMessage.tsx 创建
- [ ] flashcards-client.tsx 创建
- [ ] lib/tiptap/markdown.ts 创建
- [ ] app/ai-ui/actions.tsx 创建
- [ ] app/ai-ui/AIProvider.tsx 创建

### 组件更新
- [ ] ChatMessage.tsx 使用 StreamdownMessage
- [ ] MarkdownRenderer.tsx 使用 Streamdown
- [ ] flashcards/page.tsx 数据获取
- [ ] layout.tsx 集成 AIProvider

### 配置更新
- [ ] globals.css 添加 @source

### 清理
- [ ] 移除 react-markdown
- [ ] 移除 remark-gfm

### 验证
- [ ] typecheck 通过
- [ ] build 成功
- [ ] dev 服务器启动正常
- [ ] 各页面功能正常

---

## 参考资料

- [Streamdown 文档](https://github.com/vercel/streamdown)
- [AI SDK Generative UI](https://sdk.vercel.ai/docs/ai-sdk-ui/generative-ui)
- [Tiptap Markdown](https://tiptap.dev/docs/editor/extensions/functionality/markdown)
- [Next.js Server Components](https://nextjs.org/docs/app/building-your-application/rendering/server-components)

---

**计划状态**: ✅ 已完成，准备执行
