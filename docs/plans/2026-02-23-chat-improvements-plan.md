# 聊天系统改进实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**目标：** 改进聊天系统的代码质量、用户认证集成、标题自动生成和会话自动索引。

**架构：** 扁平化单体应用，使用 Zustand 管理状态，Next.js App Router，AI SDK v6 处理聊天流。

**技术栈：** Next.js 16, React 19, Zustand, AI SDK v6, Drizzle ORM, BullMQ, TypeScript

---

## Task 1: 代码质量提升 - 共享命令定义

**Files:**
- Create: `lib/chat/commands.ts`
- Modify: `components/chat/ChatPanel.tsx:25-80`
- Modify: `components/shared/home/HeroInput.tsx:24-88`

### Step 1: 创建共享命令文件

创建 `lib/chat/commands.ts`:

```typescript
import type { Command } from "@/types/chat";
import {
  BookOpen,
  Globe,
  GraduationCap,
  ListTodo,
  Map as MapIcon,
  Plus,
  Search,
} from "lucide-react";

/**
 * 聊天面板命令（不含 Mind Map）
 */
export const CHAT_COMMANDS: Command[] = [
  {
    id: "search",
    label: "Search Notes",
    icon: Search,
    modeLabel: "搜索笔记",
    modeIcon: Search,
    targetPath: "/search",
    getQueryParams: (input: string) => ({ q: input.trim() }),
  },
  {
    id: "create-note",
    label: "Create Note",
    icon: Plus,
    modeLabel: "创建笔记",
    modeIcon: Plus,
    targetPath: "/notes/new",
    getQueryParams: () => ({}),
  },
  {
    id: "generate-course",
    label: "Generate Course",
    icon: GraduationCap,
    modeLabel: "生成课程",
    modeIcon: GraduationCap,
    targetPath: "/courses/new",
    getQueryParams: (input: string) => ({ msg: input.trim() }),
  },
  {
    id: "create-flashcards",
    label: "Create Flashcards",
    icon: ListTodo,
    modeLabel: "创建闪卡",
    modeIcon: ListTodo,
    targetPath: "/flashcards",
    getQueryParams: (input: string) => ({ msg: input.trim() }),
  },
  {
    id: "generate-quiz",
    label: "Generate Quiz",
    icon: BookOpen,
    modeLabel: "生成测验",
    modeIcon: BookOpen,
    targetPath: "/interview",
    getQueryParams: (input: string) => ({ msg: input.trim() }),
  },
  {
    id: "web-search",
    label: "Web Search",
    icon: Globe,
    modeLabel: "联网搜索",
    modeIcon: Globe,
    targetPath: "/search",
    getQueryParams: (input: string) => ({ web: input.trim() }),
  },
];

/**
 * 首页命令（包含 Mind Map）
 */
export const HOME_COMMANDS: Command[] = [
  ...CHAT_COMMANDS,
  {
    id: "mind-map",
    label: "Mind Map",
    icon: MapIcon,
    modeLabel: "思维导图",
    modeIcon: MapIcon,
    targetPath: "/editor",
    getQueryParams: (input: string) => ({
      msg: `Create mind map: ${input.trim()}`,
    }),
  },
];

/**
 * 快捷操作配置（首页底部按钮）
 */
export const QUICK_ACTIONS = [
  { icon: Search, label: "搜索笔记" },
  { icon: Plus, label: "创建笔记" },
  { icon: GraduationCap, label: "生成课程" },
  { icon: ListTodo, label: "创建闪卡" },
  { icon: BookOpen, label: "生成测验" },
  { icon: MapIcon, label: "思维导图" },
] as const;

/**
 * 从命令输入中提取内容
 * 输入: "/search 查询内容" -> 输出: "查询内容"
 */
export function extractCommandContent(input: string): string {
  const match = input.match(/^\/\S+\s*(.*)$/);
  return match ? match[1] : "";
}
```

### Step 2: 更新 ChatPanel 使用共享命令

修改 `components/chat/ChatPanel.tsx`:

```typescript
// 移除本地的 COMMANDS 定义 (第 25-80 行)
// 添加导入
import { CHAT_COMMANDS, extractCommandContent } from "@/lib/chat/commands";

// 将 COMMANDS 替换为 CHAT_COMMANDS
const filteredCommands = (() => {
  if (!input.startsWith("/")) return CHAT_COMMANDS;
  // ... 其余逻辑不变
})();
```

### Step 3: 更新 HeroInput 使用共享命令

修改 `components/shared/home/HeroInput.tsx`:

```typescript
// 移除本地的 COMMANDS, QUICK_ACTIONS, extractCommandContent (第 24-102 行)
// 添加导入
import { HOME_COMMANDS, QUICK_ACTIONS, extractCommandContent } from "@/lib/chat/commands";

// 更新引用
const filteredCommands = (() => {
  if (!input.startsWith("/")) return HOME_COMMANDS;
  // ... 其余逻辑不变
})();
```

### Step 4: 类型检查

Run: `pnpm typecheck`
Expected: PASS（无类型错误）

### Step 5: 提交

```bash
git add lib/chat/commands.ts components/chat/ChatPanel.tsx components/shared/home/HeroInput.tsx
git commit -m "refactor(chat): extract shared commands to lib/chat/commands.ts"
```

---

## Task 2: 代码质量提升 - 修复 useChatStore 类型问题

**Files:**
- Modify: `components/chat/useChatStore.ts:26-58`

### Step 1: 移除未定义的 currentSessionId 设置

修改 `components/chat/useChatStore.ts` 中的 `createSession` 函数:

```typescript
// 移除这行 (第 51 行)
currentSessionId: session.id,

// 修改后
set((state) => ({
  sessions: [session, ...state.sessions],
}));
```

### Step 2: 类型检查

Run: `pnpm typecheck`
Expected: PASS（无 currentSessionId 类型错误）

### Step 3: 提交

```bash
git add components/chat/useChatStore.ts
git commit -m "fix(chat): remove undefined currentSessionId from useChatStore"
```

---

## Task 3: 代码质量提升 - 修复 scrollToBottom 依赖

**Files:**
- Modify: `components/chat/ChatPanel.tsx:112-118`

### Step 1: 添加缺失的依赖项

修改 `components/chat/ChatPanel.tsx`:

```typescript
// 修改 useEffect 依赖数组
useEffect(() => {
  scrollToBottom();
}, [chatMessages, scrollToBottom]);  // 添加 chatMessages
```

### Step 2: 类型检查

Run: `pnpm typecheck`
Expected: PASS

### Step 3: 提交

```bash
git add components/chat/ChatPanel.tsx
git commit -m "fix(chat): add missing chatMessages dependency to scrollToBottom"
```

---

## Task 4: 代码质量提升 - 统一 API 错误处理

**Files:**
- Create: `lib/chat/api.ts`
- Modify: `components/chat/useChatSession.ts:32-40`
- Modify: `components/chat/useChatStore.ts:29-37,39-59,61-77,79-88`

### Step 1: 创建 API 工具函数

创建 `lib/chat/api.ts`:

```typescript
import type { UIMessage } from "ai";

/**
 * 持久化会话消息到数据库
 */
export async function persistMessages(
  sessionId: string,
  messages: UIMessage[],
): Promise<void> {
  try {
    const res = await fetch(`/api/chat-sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
  } catch (error) {
    console.error("[ChatAPI] Failed to persist messages:", error);
    // TODO: 添加 Toast 通知
    throw error;
  }
}

/**
 * 加载会话列表
 */
export async function loadSessions(): Promise<any[]> {
  try {
    const res = await fetch("/api/chat-sessions");
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    const data = await res.json();
    return data.sessions || [];
  } catch (error) {
    console.error("[ChatAPI] Failed to load sessions:", error);
    return [];
  }
}

/**
 * 创建新会话
 */
export async function createSession(title: string): Promise<any | null> {
  try {
    const res = await fetch("/api/chat-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    const data = await res.json();
    return data.session;
  } catch (error) {
    console.error("[ChatAPI] Failed to create session:", error);
    return null;
  }
}

/**
 * 更新会话
 */
export async function updateSession(
  id: string,
  updates: Record<string, unknown>,
): Promise<void> {
  try {
    const res = await fetch(`/api/chat-sessions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
  } catch (error) {
    console.error("[ChatAPI] Failed to update session:", error);
    throw error;
  }
}

/**
 * 删除会话
 */
export async function deleteSession(id: string): Promise<void> {
  try {
    const res = await fetch(`/api/chat-sessions/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
  } catch (error) {
    console.error("[ChatAPI] Failed to delete session:", error);
    throw error;
  }
}
```

### Step 2: 更新 useChatSession 使用新 API

修改 `components/chat/useChatSession.ts`:

```typescript
// 添加导入
import { persistMessages } from "@/lib/chat/api";

// 移除本地的 persistMessages 函数 (第 32-40 行)
// onFinish 回调中的 persistMessages 调用会自动使用导入的版本
```

### Step 3: 更新 useChatStore 使用新 API

修改 `components/chat/useChatStore.ts`:

```typescript
// 添加导入
import { loadSessions, createSession, updateSession, deleteSession as apiDeleteSession } from "@/lib/chat/api";

// 更新 loadSessions
loadSessions: async () => {
  const sessions = await loadSessions();
  set({ sessions });
},

// 更新 createSession
createSession: async (title: string) => {
  const session = await createSession(title);
  if (!session) return null;
  set((state) => ({
    sessions: [session, ...state.sessions],
  }));
  return session;
},

// 更新 updateSession
updateSession: async (id: string, updates: any) => {
  await updateSession(id, updates);
  const res = await fetch(`/api/chat-sessions/${id}`);
  const data = await res.json();
  const updated = data.session;
  set((state) => ({
    sessions: state.sessions.map((s) => (s.id === id ? updated : s)),
  }));
},

// 更新 deleteSession
deleteSession: async (id: string) => {
  await apiDeleteSession(id);
  set((state) => ({
    sessions: state.sessions.filter((s) => s.id !== id),
  }));
},
```

### Step 4: 类型检查

Run: `pnpm typecheck`
Expected: PASS

### Step 5: 提交

```bash
git add lib/chat/api.ts components/chat/useChatSession.ts components/chat/useChatStore.ts
git commit -m "refactor(chat): extract API functions to lib/chat/api.ts with error handling"
```

---

## Task 5: 用户认证集成 - 升级 UserAvatar

**Files:**
- Modify: `components/shared/layout/UserAvatar.tsx`

### Step 1: 更新 UserAvatar 组件

完整替换 `components/shared/layout/UserAvatar.tsx`:

```typescript
"use client";

import { User } from "lucide-react";
import { useAuthStore } from "@/components/auth";

interface UserAvatarProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function UserAvatar({ className = "", size = "md" }: UserAvatarProps) {
  const { user, isLoading } = useAuthStore();

  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-10 h-10",
    lg: "w-12 h-12",
  };

  const iconSizes = {
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-6 h-6",
  };

  // 加载状态
  if (isLoading) {
    return (
      <div
        className={`${sizeClasses[size]} rounded-full bg-zinc-100 animate-pulse ${className}`}
      />
    );
  }

  // 有头像图片
  if (user?.image) {
    return (
      <img
        src={user.image}
        alt={user.name || "User"}
        className={`${sizeClasses[size]} rounded-full object-cover ${className}`}
      />
    );
  }

  // 显示用户名首字母或占位符
  const initials = user?.name
    ? user.name.slice(0, 2).toUpperCase()
    : user?.email
      ? user.email.slice(0, 2).toUpperCase()
      : "?";

  return (
    <div
      className={`${sizeClasses[size]} rounded-full bg-[var(--color-accent)] text-[var(--color-accent-fg)] flex items-center justify-center font-medium cursor-pointer hover:opacity-80 transition-opacity ${className}`}
    >
      <span className="text-sm">{initials}</span>
    </div>
  );
}
```

### Step 2: 类型检查

Run: `pnpm typecheck`
Expected: PASS

### Step 3: 提交

```bash
git add components/shared/layout/UserAvatar.tsx
git commit -m "feat(auth): upgrade UserAvatar to show real user info"
```

---

## Task 6: 用户认证集成 - 首页登录检查

**Files:**
- Modify: `app/page.tsx`

### Step 1: 添加登录状态检测

修改 `app/page.tsx`:

```typescript
"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useChatStore } from "@/components/chat";
import { useAuthStore } from "@/components/auth";
import { HeroInput, RecentSection } from "@/components/shared/home";
import { FloatingHeader } from "@/components/shared/layout";
import { LogIn } from "lucide-react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const loadSessions = useChatStore((state) => state.loadSessions);
  const { isAuthenticated, isLoading: authLoading } = useAuthStore();
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated) {
      loadSessions();
    }
  }, [loadSessions, isAuthenticated]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      // 延迟显示登录提示
      const timer = setTimeout(() => setShowAuthPrompt(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [authLoading, isAuthenticated]);

  const handleLoginClick = () => {
    router.push("/login");
  };

  return (
    <main className="min-h-screen bg-slate-50">
      <FloatingHeader />

      <div className="max-w-4xl mx-auto px-6 pt-28 pb-20">
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-14"
        >
          <h1 className="text-4xl md:text-5xl font-bold text-zinc-900 mb-3 tracking-tight">
            你的私人学习顾问
          </h1>
          <p className="text-lg text-zinc-500">让 AI 为你规划、记忆、测评</p>
        </motion.header>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-14"
        >
          <HeroInput />
        </motion.div>

        <RecentSection />

        {/* 登录提示 */}
        {showAuthPrompt && !isAuthenticated && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 p-4 bg-blue-50 rounded-xl border border-blue-100"
          >
            <div className="flex items-center gap-3">
              <LogIn className="w-5 h-5 text-blue-500" />
              <div className="flex-1">
                <p className="text-sm text-blue-800">
                  登录后可以保存对话历史，获得更好的体验
                </p>
              </div>
              <button
                onClick={handleLoginClick}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition-colors"
              >
                登录
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </main>
  );
}
```

### Step 2: 类型检查

Run: `pnpm typecheck`
Expected: PASS

### Step 3: 提交

```bash
git add app/page.tsx
git commit -m "feat(auth): add login prompt on home page for unauthenticated users"
```

---

## Task 7: 会话自动索引 - API 端点

**Files:**
- Create: `app/api/chat-sessions/index/route.ts`

### Step 1: 创建索引 API 端点

创建 `app/api/chat-sessions/index/route.ts`:

```typescript
import { enqueueConversationIndex } from "@/lib/queue";
import { NextResponse } from "next/server";
import type { UIMessage } from "ai";

interface IndexRequest {
  sessionId: string;
  messages: UIMessage[];
}

export async function POST(request: Request) {
  try {
    const body: IndexRequest = await request.json();
    const { sessionId, messages } = body;

    if (!sessionId) {
      return NextResponse.json({ error: "Session ID is required" }, { status: 400 });
    }

    // TODO: 添加用户验证
    // const session = await getServerSession(authOptions);
    // if (!session?.user?.id) {
    //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // }

    await enqueueConversationIndex(sessionId, "user-id-placeholder", messages);

    return NextResponse.json({ success: true, enqueued: true });
  } catch (error) {
    console.error("[IndexAPI] Error:", error);
    return NextResponse.json({ error: "Failed to enqueue index job" }, { status: 500 });
  }
}
```

### Step 2: 类型检查

Run: `pnpm typecheck`
Expected: PASS

### Step 3: 提交

```bash
git add app/api/chat-sessions/index/route.ts
git commit -m "feat(api): add chat session index endpoint"
```

---

## Task 8: 会话自动索引 - 集成到 useChatSession

**Files:**
- Modify: `components/chat/useChatSession.ts:52-57`

### Step 1: 在 onFinish 中触发索引

修改 `components/chat/useChatSession.ts`:

```typescript
// 添加触发索引的函数
async function triggerIndex(sessionId: string, messages: UIMessage[]) {
  try {
    await fetch("/api/chat-sessions/index", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, messages }),
    });
  } catch (error) {
    console.error("[ChatSession] Failed to trigger index:", error);
  }
}

// 修改 onFinish 回调
onFinish: async ({ messages }) => {
  if (sessionId) {
    await persistMessages(sessionId, messages);
    // 触发后台索引
    triggerIndex(sessionId, messages).catch(console.error);
  }
},
```

### Step 2: 类型检查

Run: `pnpm typecheck`
Expected: PASS

### Step 3: 提交

```bash
git add components/chat/useChatSession.ts
git commit -m "feat(chat): trigger conversation index on chat finish"
```

---

## Task 9: 标题自动生成 - API 端点

**Files:**
- Create: `app/api/chat-sessions/generate-titles/route.ts`

### Step 1: 创建标题生成 API

创建 `app/api/chat-sessions/generate-titles/route.ts`:

```typescript
import { conversations, db, eq } from "@/db";
import { generateObject } from "ai";
import { NextResponse } from "next/server";
import { aiProvider } from "@/lib/ai/provider";

export async function POST(request: Request) {
  try {
    // 获取需要生成标题的会话（默认标题或 summary 为空）
    const sessions = await db
      .select()
      .from(conversations)
      .where(eq(conversations.title, "新对话"))
      .limit(5);

    if (sessions.length === 0) {
      return NextResponse.json({ updated: 0, message: "No sessions to process" });
    }

    let updatedCount = 0;

    for (const session of sessions) {
      try {
        // 从消息中提取用户输入
        const firstUserMessage = session.messages
          ?.filter((m: any) => m.role === "user")
          .map((m: any) => {
            if (typeof m === "string") return m;
            if (m.content) return m.content;
            // 处理 AI SDK v6 parts 格式
            if (m.parts) {
              return m.parts
                .filter((p: any) => p.type === "text")
                .map((p: any) => p.text)
                .join("");
            }
            return "";
          })
          .join("\n")
          .slice(0, 200);

        if (!firstUserMessage) continue;

        // 生成标题
        const { object } = await generateObject({
          model: aiProvider.chatModel,
          schema: {
            title: {
              type: "string",
              description: "会话标题，10字以内",
            },
          },
          prompt: `为以下对话生成一个简短标题（10字以内）:\n\n${firstUserMessage}`,
        });

        if (object.title) {
          await db
            .update(conversations)
            .set({ title: object.title })
            .where(eq(conversations.id, session.id));
          updatedCount++;
        }
      } catch (error) {
        console.error(`[GenerateTitles] Failed for session ${session.id}:`, error);
      }
    }

    return NextResponse.json({ updated: updatedCount });
  } catch (error) {
    console.error("[GenerateTitles] Error:", error);
    return NextResponse.json({ error: "Failed to generate titles" }, { status: 500 });
  }
}
```

### Step 2: 类型检查

Run: `pnpm typecheck`
Expected: PASS

### Step 3: 提交

```bash
git add app/api/chat-sessions/generate-titles/route.ts
git commit -m "feat(api): add batch title generation endpoint"
```

---

## Task 10: 标题自动生成 - 前端触发

**Files:**
- Modify: `components/chat/useChatStore.ts:29-37`

### Step 1: 在 loadSessions 后触发批量生成

修改 `components/chat/useChatStore.ts`:

```typescript
// 添加批量生成标题函数
async function generateBatchTitles() {
  try {
    const res = await fetch("/api/chat-sessions/generate-titles", {
      method: "POST",
    });
    const data = await res.json();
    if (data.updated > 0) {
      // 重新加载会话列表以获取新标题
      loadSessions();
    }
  } catch (error) {
    console.error("[ChatStore] Failed to generate batch titles:", error);
  }
}

// 修改 loadSessions
loadSessions: async () => {
  const sessions = await loadSessions();
  set({ sessions });

  // 如果有默认标题的会话，触发批量生成
  const hasDefaultTitles = sessions.some((s) => s.title === "新对话");
  if (hasDefaultTitles) {
    generateBatchTitles();
  }
},
```

### Step 2: 类型检查

Run: `pnpm typecheck`
Expected: PASS

### Step 3: 提交

```bash
git add components/chat/useChatStore.ts
git commit -m "feat(chat): trigger batch title generation after loading sessions"
```

---

## 验收检查清单

运行以下命令验证所有更改：

```bash
# 类型检查
pnpm typecheck

# Lint 检查
pnpm lint

# 构建检查
pnpm build
```

手动验证：
- [ ] 首页显示登录提示（未登录时）
- [ ] UserAvatar 显示用户信息（登录后）
- [ ] 聊天对话正常工作
- [ ] 对话结束后触发索引（检查控制台日志）
- [ ] 批量生成标题功能正常

---

## 完成

所有任务完成后，创建总结提交：

```bash
git add docs/plans/2026-02-23-chat-improvements-*
git commit -m "docs: complete chat system improvements implementation plan"
```
