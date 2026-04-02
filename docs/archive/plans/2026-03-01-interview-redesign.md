# Interview System Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the interview system with a split-panel layout (outline on left, chat on right) where AI generates a complete outline every round that updates in real-time.

**Architecture:** Interview page has two panels. Left panel shows the current outline (fetched from courseProfile). Right panel is the chat interface. AI calls `updateOutline` tool every round to update the outline. Options are embedded in AI response as structured data, rendered as clickable buttons that send text messages.

**Tech Stack:** React 19, Next.js 16, AI SDK v6, Zustand, Drizzle ORM, Framer Motion

---

## Task 1: Create Outline Panel Component

**Files:**
- Create: `components/interview/OutlinePanel.tsx`

**Step 1: Create the OutlinePanel component**

```tsx
/**
 * OutlinePanel - 左侧大纲面板
 *
 * 实时展示当前课程大纲
 */

"use client";

import { GraduationCap, Clock, BookOpen } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Chapter {
  title: string;
  description?: string;
  topics?: string[];
}

interface OutlineData {
  title: string;
  description?: string;
  estimatedMinutes?: number;
  chapters: Chapter[];
}

interface OutlinePanelProps {
  outline: OutlineData | null;
  isLoading?: boolean;
}

export function OutlinePanel({ outline, isLoading }: OutlinePanelProps) {
  return (
    <div className="h-full flex flex-col bg-zinc-50 dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <GraduationCap className="w-4 h-4 text-purple-600" />
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            学习大纲
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center h-32"
            >
              <div className="w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
            </motion.div>
          ) : !outline ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-8"
            >
              <BookOpen className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
              <p className="text-sm text-zinc-400">
                告诉我你想学什么<br />大纲会在这里显示
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="outline"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {/* Title */}
              <h3 className="text-base font-semibold text-zinc-800 dark:text-zinc-200 mb-1">
                {outline.title}
              </h3>

              {outline.description && (
                <p className="text-xs text-zinc-500 mb-3">
                  {outline.description}
                </p>
              )}

              {/* Estimated Time */}
              {outline.estimatedMinutes && (
                <div className="flex items-center gap-1 text-xs text-zinc-500 mb-4">
                  <Clock className="w-3 h-3" />
                  <span>预计 {Math.round(outline.estimatedMinutes / 60)} 小时</span>
                </div>
              )}

              {/* Chapters */}
              <div className="space-y-2">
                {outline.chapters.map((chapter, index) => (
                  <div
                    key={`${chapter.title}-${index}`}
                    className="p-2 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700"
                  >
                    <div className="flex items-start gap-2">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-400 text-xs flex items-center justify-center font-medium">
                        {index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                          {chapter.title}
                        </div>
                        {chapter.topics && chapter.topics.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {chapter.topics.slice(0, 3).map((topic) => (
                              <span
                                key={topic}
                                className="px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400 rounded text-xs"
                              >
                                {topic}
                              </span>
                            ))}
                            {chapter.topics.length > 3 && (
                              <span className="text-xs text-zinc-400">
                                +{chapter.topics.length - 3}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add components/interview/OutlinePanel.tsx
git commit -m "feat(interview): add OutlinePanel component"
```

---

## Task 2: Create Interview Options Component

**Files:**
- Create: `components/interview/InterviewOptions.tsx`

**Step 1: Create the InterviewOptions component**

```tsx
/**
 * InterviewOptions - 访谈选项组件
 *
 * 展示 AI 生成的选项，用户可以点击或自由输入
 */

"use client";

import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Option {
  label: string;
  action?: string;
}

interface InterviewOptionsProps {
  options: Option[];
  onSelect: (option: string) => void;
}

export function InterviewOptions({ options, onSelect }: InterviewOptionsProps) {
  if (!options || options.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {options.map((option, index) => (
        <motion.button
          key={`${option.label}-${index}`}
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onSelect(option.label)}
          className={cn(
            "px-3 py-1.5 rounded-lg text-sm transition-all duration-200",
            "flex items-center gap-1",
            "bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300",
            "border border-zinc-200 dark:border-zinc-700",
            "hover:bg-purple-50 dark:hover:bg-zinc-700",
            "hover:border-purple-300 dark:hover:border-purple-700",
          )}
        >
          <span>{option.label}</span>
          <ChevronRight className="w-3 h-3 text-zinc-400" />
        </motion.button>
      ))}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add components/interview/InterviewOptions.tsx
git commit -m "feat(interview): add InterviewOptions component"
```

---

## Task 3: Create Interview Store

**Files:**
- Create: `stores/interview.ts`

**Step 1: Create the interview store**

```typescript
/**
 * Interview Store - 访谈状态管理
 *
 * 管理当前大纲数据
 */

import { create } from "zustand";

interface Chapter {
  title: string;
  description?: string;
  topics?: string[];
}

interface OutlineData {
  title: string;
  description?: string;
  estimatedMinutes?: number;
  chapters: Chapter[];
}

interface InterviewStore {
  outline: OutlineData | null;
  courseProfileId: string | null;
  isOutlineLoading: boolean;

  setOutline: (outline: OutlineData | null) => void;
  setCourseProfileId: (id: string | null) => void;
  setIsOutlineLoading: (loading: boolean) => void;
}

export const useInterviewStore = create<InterviewStore>((set) => ({
  outline: null,
  courseProfileId: null,
  isOutlineLoading: false,

  setOutline: (outline) => set({ outline }),
  setCourseProfileId: (id) => set({ courseProfileId: id }),
  setIsOutlineLoading: (loading) => set({ isOutlineLoading: loading }),
}));
```

**Step 2: Commit**

```bash
git add stores/interview.ts
git commit -m "feat(interview): add interview store"
```

---

## Task 4: Create useInterview Hook (Updated)

**Files:**
- Modify: `hooks/useInterview.ts`

**Step 1: Update useInterview hook to sync outline**

Replace the entire file with:

```typescript
/**
 * useInterview - 独立访谈 Hook
 *
 * 2026 架构：
 * - 调用 /api/interview
 * - 无 Persona 干扰
 * - 服务端管理 courseProfileId
 * - 同步大纲到 store
 */

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { nanoid } from "nanoid";
import { useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { parseApiError } from "@/lib/api/client";
import { useInterviewStore } from "@/stores/interview";

interface UseInterviewOptions {
  initialMessage?: string;
}

interface UseInterviewReturn {
  messages: UIMessage[];
  sendMessage: (params: { text: string }) => void;
  status: string;
  isLoading: boolean;
  sessionId: string;
  addToolOutput: (params: {
    tool: string;
    toolCallId: string;
    output: unknown;
  }) => Promise<void>;
}

export function useInterview(options?: UseInterviewOptions): UseInterviewReturn {
  const { addToast } = useToast();
  const [sessionId] = useState(() => nanoid());

  const setOutline = useInterviewStore((s) => s.setOutline);
  const setCourseProfileId = useInterviewStore((s) => s.setCourseProfileId);
  const setIsOutlineLoading = useInterviewStore((s) => s.setIsOutlineLoading);

  const chat = useChat({
    id: sessionId,
    transport: new DefaultChatTransport({
      api: "/api/interview",
      body: () => ({ sessionId }),
    }),
    onError: (error) => {
      console.error("[Interview] API Error:", error);
      parseApiError(error).then(({ message }) => {
        addToast(message, "error");
      });
    },
    onResponse: (response) => {
      // 从 response header 获取 courseProfileId
      const profileId = response.headers.get("X-Course-Profile-Id");
      if (profileId) {
        setCourseProfileId(profileId);
      }
    },
  });

  const { sendMessage, status, addToolOutput, messages } = chat;

  // 自动发送初始消息
  const sentInitialRef = useRef(false);
  const initialMessageRef = useRef(options?.initialMessage);

  useEffect(() => {
    initialMessageRef.current = options?.initialMessage;
  }, [options?.initialMessage]);

  useEffect(() => {
    const msg = initialMessageRef.current;
    if (msg && !sentInitialRef.current) {
      sentInitialRef.current = true;
      requestAnimationFrame(() => {
        sendMessage({ text: msg });
      });
    }
  }, [sendMessage]);

  // 监听消息变化，从 tool output 提取大纲
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== "assistant") return;

    // 查找 updateOutline tool output
    const toolParts = lastMessage.parts?.filter(
      (p) => p.type === "tool-updateOutline" && p.state === "output-available"
    );

    if (toolParts && toolParts.length > 0) {
      const lastToolPart = toolParts[toolParts.length - 1];
      const output = lastToolPart.output as { outline?: unknown } | undefined;
      if (output?.outline) {
        setOutline(output.outline as never);
        setIsOutlineLoading(false);
      }
    }
  }, [messages, setOutline, setIsOutlineLoading]);

  return {
    messages: chat.messages as UIMessage[],
    sendMessage: chat.sendMessage,
    status,
    // @ts-expect-error AI SDK 6.0 compatibility
    isLoading: chat.isLoading,
    sessionId,
    addToolOutput,
  };
}
```

**Step 2: Commit**

```bash
git add hooks/useInterview.ts
git commit -m "refactor(interview): update hook to sync outline to store"
```

---

## Task 5: Update Interview Tools

**Files:**
- Modify: `lib/ai/tools/interview/index.ts`

**Step 1: Remove suggestOptions tool**

Delete lines 142-162 (SuggestOptionsSchema and suggestOptionsTool).

**Step 2: Add updateOutline tool**

Add after the updateProfileTool (around line 139):

```typescript
// ============================================
// 3. updateOutline - 更新课程大纲（每轮调用）
// ============================================

export const OutlineChapterSchema = z.object({
  title: z.string().describe("章节标题"),
  description: z.string().optional().describe("章节描述"),
  topics: z.array(z.string()).optional().describe("章节包含的主题"),
});

export const UpdateOutlineSchema = z.object({
  courseProfileId: z.string().uuid().describe("课程画像 ID"),
  title: z.string().describe("课程标题"),
  description: z.string().optional().describe("课程描述"),
  estimatedMinutes: z.number().optional().describe("预计学习时间(分钟)"),
  chapters: z.array(OutlineChapterSchema).min(1).describe("章节列表"),
});

export const updateOutlineTool = tool({
  description:
    "更新课程大纲。每轮对话后调用，生成完整的课程大纲。用户可以根据大纲反馈调整。",
  inputSchema: UpdateOutlineSchema,
  execute: async ({ courseProfileId, title, description, estimatedMinutes, chapters }) => {
    try {
      const outlineData = {
        title,
        description,
        estimatedMinutes,
        chapters,
      };

      // 更新数据库
      await db
        .update(courseProfiles)
        .set({
          title,
          description,
          estimatedMinutes,
          outlineData,
          updatedAt: new Date(),
        })
        .where(eq(courseProfiles.id, courseProfileId));

      return {
        success: true,
        outline: outlineData,
        message: "大纲已更新",
      };
    } catch (error) {
      console.error("[Tool] updateOutline error:", error);
      return { success: false, error: "更新大纲失败" };
    }
  },
});
```

**Step 3: Update interviewTools export**

Update the export object:

```typescript
export const interviewTools = {
  assessComplexity: assessComplexityTool,
  createCourseProfile: createCourseProfileTool,
  updateProfile: updateProfileTool,
  updateOutline: updateOutlineTool,
  confirmOutline: confirmOutlineTool,
  // Removed: suggestOptions, proposeOutline (replaced by updateOutline)
};
```

**Step 4: Remove proposeOutline tool (optional)**

Since we now use `updateOutline` every round, `proposeOutline` is no longer needed. Remove lines 167-190 if desired, or keep it for the final confirmation step.

**Step 5: Commit**

```bash
git add lib/ai/tools/interview/index.ts
git commit -m "refactor(interview): replace suggestOptions with updateOutline tool"
```

---

## Task 6: Update Agent Instructions

**Files:**
- Modify: `lib/ai/agents/index.ts`

**Step 1: Update interview instructions**

Replace the interview instructions (lines 58-88) with:

```typescript
  interview: `你是 NexusNote 的课程规划师。

## 核心任务
通过自然对话了解用户的学习需求，每轮都生成完整课程大纲。

## 工作流程

1. **首轮**：用户说想学 X
   - 调用 assessComplexity 评估复杂度
   - 调用 createCourseProfile 创建画像
   - 调用 updateOutline 生成初版大纲
   - 文字确认 + 提问（附带选项）

2. **每轮**：用户回答
   - 调用 updateProfile 更新画像
   - 调用 updateOutline 更新大纲
   - 文字回应 + 继续提问（附带选项）

3. **完成**：用户满意
   - 大纲即为最终版本
   - 告知用户可以开始学习

## 选项格式
在回复末尾，使用 JSON 格式提供选项：
\`\`\`json
{"options": [{"label": "选项1"}, {"label": "选项2"}, {"label": "自定义"}]}
\`\`\`

## 行为准则
- 主动、简洁、自然
- 像朋友聊天，不审问
- 每次回复都要有文字
- 每轮都要调用 updateOutline 更新大纲`,
```

**Step 2: Update interviewTools in agent**

Update the interviewTools definition (around line 173):

```typescript
const interviewTools = {
  assessComplexity: assessComplexityTool,
  createCourseProfile: createCourseProfileTool,
  updateProfile: updateProfileTool,
  updateOutline: updateOutlineTool,
  confirmOutline: confirmOutlineTool,
} as ToolSet;
```

**Step 3: Commit**

```bash
git add lib/ai/agents/index.ts
git commit -m "refactor(agents): update interview instructions for new flow"
```

---

## Task 7: Update Tool Result Renderer

**Files:**
- Modify: `components/chat/tool-result/ToolResultRenderer.tsx`

**Step 1: Remove suggestOptions case**

Delete lines 131-153 (the `case "suggestOptions"` block).

**Step 2: Add updateOutline case**

Add before the `case "proposeOutline"`:

```typescript
    case "updateOutline": {
      // 大纲在左侧面板显示，对话区不显示
      return null;
    }
```

**Step 3: Update proposeOutline case (if kept)**

If you kept `proposeOutline`, update it to also return null since outline is in the side panel:

```typescript
    case "proposeOutline": {
      // 大纲在左侧面板显示，对话区不显示
      return null;
    }
```

**Step 4: Commit**

```bash
git add components/chat/tool-result/ToolResultRenderer.tsx
git commit -m "refactor(ui): remove suggestOptions rendering, hide outline in chat"
```

---

## Task 8: Update Interview Page Layout

**Files:**
- Modify: `app/interview/page.tsx`

**Step 1: Redesign page with split layout**

Replace the entire file with:

```tsx
"use client";

import type { UIMessage } from "ai";
import { motion } from "framer-motion";
import { ArrowLeft, GraduationCap, Loader2, Send } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChatMessage, LoadingDots } from "@/components/chat/ChatMessage";
import { InterviewOptions } from "@/components/interview/InterviewOptions";
import { OutlinePanel } from "@/components/interview/OutlinePanel";
import { useInterview } from "@/hooks/useInterview";
import { useInterviewStore } from "@/stores/interview";
import { cn } from "@/lib/utils";

export default function InterviewPage() {
  const searchParams = useSearchParams();
  const initialMessage = searchParams.get("msg");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");
  const [started, setStarted] = useState(false);

  const interview = useInterview({
    initialMessage: initialMessage || undefined,
  });

  const outline = useInterviewStore((s) => s.outline);
  const isOutlineLoading = useInterviewStore((s) => s.isOutlineLoading);

  // 标记是否已开始
  useEffect(() => {
    if (initialMessage && !started) {
      setStarted(true);
    }
  }, [initialMessage, started]);

  const messages = interview.messages;
  const sendMessage = interview.sendMessage;
  const status = interview.status;
  const isLoading = interview.isLoading;
  const addToolOutput = interview.addToolOutput;

  const chatMessages = messages.filter((m: UIMessage) => m.role !== "system");

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [scrollToBottom]);

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

  const handleOptionSelect = (option: string) => {
    sendMessage({ text: option });
  };

  const lastMsg = chatMessages[chatMessages.length - 1];
  const isAILoading =
    (status === "submitted" || status === "streaming") && (!lastMsg || lastMsg.role === "user");

  // 从最后一条 AI 消息提取选项
  const lastAIMessage = chatMessages.filter((m) => m.role === "assistant").pop();
  const lastOptions = extractOptionsFromMessage(lastAIMessage);

  return (
    <div className="flex h-screen bg-white">
      {/* Left Panel - Outline */}
      <div className="w-80 flex-shrink-0 hidden md:block">
        <OutlinePanel outline={outline} isLoading={isOutlineLoading} />
      </div>

      {/* Right Panel - Chat */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="flex items-center gap-4 px-4 md:px-6 py-4 border-b border-zinc-100">
          <Link
            href="/chat"
            className="p-2 hover:bg-zinc-100 rounded-lg transition-colors"
            aria-label="返回聊天"
          >
            <ArrowLeft className="w-5 h-5 text-zinc-500" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-zinc-800">课程访谈</h1>
              <p className="text-xs text-zinc-400">告诉我你想学什么</p>
            </div>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto mobile-scroll px-4 md:px-6 py-4">
          <div className="max-w-2xl mx-auto space-y-4">
            {/* 空状态 */}
            {chatMessages.length === 0 && !isLoading && !started && (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <GraduationCap className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-lg font-medium text-zinc-700 mb-2">你想学什么？</h2>
                <p className="text-sm text-zinc-400 mb-6">告诉我你的学习目标，我会为你定制课程</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {["我想学 Python", "我想学做 PPT", "考研数学怎么准备", "教我做川菜"].map(
                    (example) => (
                      <button
                        key={example}
                        type="button"
                        onClick={() => {
                          setStarted(true);
                          sendMessage({ text: example });
                        }}
                        className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 rounded-full text-sm text-zinc-600 transition-colors"
                      >
                        {example}
                      </button>
                    ),
                  )}
                </div>
              </div>
            )}

            {chatMessages.map((msg) => (
              <ChatMessage
                key={msg.id}
                message={msg}
                onSendReply={(text) => sendMessage({ text })}
                addToolOutput={addToolOutput}
              />
            ))}

            {/* Options after last AI message */}
            {lastOptions && lastOptions.length > 0 && !isAILoading && (
              <InterviewOptions options={lastOptions} onSelect={handleOptionSelect} />
            )}

            {isAILoading && <LoadingDots />}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input */}
        <div className="border-t border-zinc-100 bg-white px-4 md:px-6 py-3 md:py-4">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-end gap-2 md:gap-3 bg-zinc-50 rounded-2xl p-2 md:p-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                <GraduationCap className="w-4 h-4 text-white" />
              </div>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="继续对话..."
                rows={1}
                className="flex-1 bg-transparent border-none outline-none text-sm text-zinc-800 placeholder:text-zinc-400 resize-none min-h-[24px] max-h-[120px]"
              />
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleSubmit}
                disabled={!input.trim() || isLoading}
                className={cn(
                  "w-9 h-9 rounded-xl flex items-center justify-center transition-colors flex-shrink-0",
                  input.trim() && !isLoading
                    ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white"
                    : "bg-zinc-200 text-zinc-400 cursor-not-allowed",
                )}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </motion.button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// 从 AI 消息中提取选项
function extractOptionsFromMessage(message: UIMessage | undefined): Array<{ label: string }> | null {
  if (!message?.parts) return null;

  const textPart = message.parts.find((p) => p.type === "text");
  if (!textPart || !("text" in textPart)) return null;

  const text = textPart.text;

  // 查找 JSON 选项块
  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch[1]);
    if (parsed.options && Array.isArray(parsed.options)) {
      return parsed.options;
    }
  } catch {
    // Ignore parse errors
  }

  return null;
}
```

**Step 2: Commit**

```bash
git add app/interview/page.tsx
git commit -m "feat(interview): redesign page with split-panel layout"
```

---

## Task 9: Update Interview API Route

**Files:**
- Modify: `app/api/interview/route.ts`

**Step 1: Ensure API returns courseProfileId header**

The current implementation already does this (line 179), so no changes needed.

**Step 2: Verify the route works with new tools**

The route passes messages to the agent, and the agent will use the new `updateOutline` tool. No changes needed.

**Step 3: Commit (if any changes)**

```bash
git add app/api/interview/route.ts
git commit -m "docs: verify interview API works with new tools"
```

---

## Task 10: Verification

**Step 1: Run typecheck**

```bash
bun run typecheck
```

Expected: No errors

**Step 2: Run linter**

```bash
bun run lint
```

Expected: No errors (or auto-fix with `bun run lint --write`)

**Step 3: Test the interview flow**

1. Start dev server: `bun dev`
2. Navigate to `http://localhost:3000/interview`
3. Send "我想学 Python"
4. Verify:
   - Left panel shows outline after AI responds
   - Options appear below AI message
   - Clicking option sends text
   - Typing in input works
   - Outline updates each round

**Step 4: Final commit (if any fixes)**

```bash
git add -A
git commit -m "fix: interview redesign cleanup"
```

---

## Summary of Changes

| File | Change |
|------|--------|
| `components/interview/OutlinePanel.tsx` | Create - Left panel outline display |
| `components/interview/InterviewOptions.tsx` | Create - Option buttons component |
| `stores/interview.ts` | Create - Interview state store |
| `hooks/useInterview.ts` | Modify - Sync outline to store |
| `lib/ai/tools/interview/index.ts` | Modify - Remove suggestOptions, add updateOutline |
| `lib/ai/agents/index.ts` | Modify - Update interview instructions |
| `components/chat/tool-result/ToolResultRenderer.tsx` | Modify - Remove suggestOptions case |
| `app/interview/page.tsx` | Modify - Split-panel layout |

---

## Testing Checklist

- [ ] `bun run typecheck` passes
- [ ] `bun run lint` passes
- [ ] Interview page loads with split layout
- [ ] Left panel shows "empty" state initially
- [ ] AI responds with text + options
- [ ] Options are clickable and send text
- [ ] User can type freely instead of clicking options
- [ ] Outline updates in left panel after each round
- [ ] `updateOutline` tool is called every round
