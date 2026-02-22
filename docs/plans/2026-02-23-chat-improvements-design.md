# 聊天系统改进设计

| 文档属性 | 内容 |
|:---|:---|
| **版本号** | v1.0.0 |
| **状态** | **待批准** |
| **创建日期** | 2026-02-23 |

---

## 1. 概述

本文档描述了对 NexusNote 聊天系统的全面改进方案。项目已从 monorepo 重构为单体应用，代码结构更加扁平化。

### 当前架构
```
nexusnote/
├── app/                    # Next.js App Router
│   ├── api/               # API 路由
│   ├── chat/              # 聊天页面
│   └── layout.tsx         # 根布局
├── components/            # 组件（扁平结构）
│   ├── auth/              # 认证
│   ├── chat/              # 聊天组件
│   └── shared/            # 共享组件
├── db/                    # 数据库 schema
├── lib/                   # 工具库
│   ├── ai/                # AI 相关
│   └── rag/               # RAG 相关
└── types/                 # 类型定义
```

---

## 2. 代码质量提升

### 2.1 问题分析

1. **重复代码**：`COMMANDS` 在 `HeroInput.tsx` 和 `ChatPanel.tsx` 重复定义
2. **类型问题**：`useChatStore` 设置了 `currentSessionId` 但接口未定义
3. **状态同步**：`scrollToBottom` 依赖项缺失 `chatMessages`
4. **错误处理**：API 调用仅 catch，无用户反馈

### 2.2 改进方案

#### 2.2.1 共享命令定义

创建 `/lib/chat/commands.ts`：
```typescript
import type { Command } from "@/types/chat";
import { BookOpen, Globe, GraduationCap, ListTodo, Map as MapIcon, Plus, Search } from "lucide-react";

export const CHAT_COMMANDS: Command[] = [
  { id: "search", label: "Search Notes", icon: Search, modeLabel: "搜索笔记", modeIcon: Search, targetPath: "/search", getQueryParams: (input) => ({ q: input.trim() }) },
  { id: "create-note", label: "Create Note", icon: Plus, modeLabel: "创建笔记", modeIcon: Plus, targetPath: "/notes/new", getQueryParams: () => ({}) },
  { id: "generate-course", label: "Generate Course", icon: GraduationCap, modeLabel: "生成课程", modeIcon: GraduationCap, targetPath: "/courses/new", getQueryParams: (input) => ({ msg: input.trim() }) },
  { id: "create-flashcards", label: "Create Flashcards", icon: ListTodo, modeLabel: "创建闪卡", modeIcon: ListTodo, targetPath: "/flashcards", getQueryParams: (input) => ({ msg: input.trim() }) },
  { id: "generate-quiz", label: "Generate Quiz", icon: BookOpen, modeLabel: "生成测验", modeIcon: BookOpen, targetPath: "/interview", getQueryParams: (input) => ({ msg: input.trim() }) },
  { id: "web-search", label: "Web Search", icon: Globe, modeLabel: "联网搜索", modeIcon: Globe, targetPath: "/search", getQueryParams: (input) => ({ web: input.trim() }) },
];

export const HOME_COMMANDS: Command[] = [
  ...CHAT_COMMANDS,
  { id: "mind-map", label: "Mind Map", icon: MapIcon, modeLabel: "思维导图", modeIcon: MapIcon, targetPath: "/editor", getQueryParams: (input) => ({ msg: `Create mind map: ${input.trim()}` }) },
];
```

#### 2.2.2 修复类型问题

修改 `useChatStore.ts`，移除未定义的 `currentSessionId` 设置。

#### 2.2.3 修复依赖项

在 `ChatPanel.tsx` 中修复 `scrollToBottom` 依赖。

#### 2.2.4 统一错误处理

创建 `/lib/chat/api.ts`：
```typescript
export async function persistMessages(sessionId: string, messages: UIMessage[]) {
  try {
    const res = await fetch(`/api/chat-sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error("[Chat] Failed to persist:", error);
    // TODO: 显示 Toast 通知
    throw error;
  }
}
```

---

## 3. 用户认证集成

### 3.1 当前状态

- `AuthSync` 组件已同步 NextAuth Session 到 Zustand
- `useAuthStore` 提供用户状态
- `UserAvatar` 组件显示占位符

### 3.2 改进方案

#### 3.2.1 升级 UserAvatar

```typescript
// components/shared/layout/UserAvatar.tsx
"use client";

import { User } from "lucide-react";
import { useAuthStore } from "@/components/auth";

export function UserAvatar({ className = "", size = "md" }: UserAvatarProps) {
  const { user, isLoading } = useAuthStore();
  const sizeClasses = { sm: "w-8 h-8", md: "w-10 h-10", lg: "w-12 h-12" };

  if (isLoading) {
    return <div className={`${sizeClasses[size]} rounded-full bg-zinc-100 animate-pulse`} />;
  }

  if (user?.image) {
    return <img src={user.image} alt={user.name || ""} className={`${sizeClasses[size]} rounded-full`} />;
  }

  const initials = user?.name?.slice(0, 2).toUpperCase() || "?";

  return (
    <div className={`${sizeClasses[size]} rounded-full bg-[var(--color-accent)] text-[var(--color-accent-fg)] flex items-center justify-center font-medium`}>
      {initials}
    </div>
  );
}
```

#### 3.2.2 登录检查

在 `HomePage` 添加登录状态检测，未登录时显示登录 CTA。

---

## 4. 标题自动生成

### 4.1 方案：批量生成

1. **时机**：后台定时任务（每 5 分钟）
2. **范围**：`title = '新对话'` 或 `summary` 为空的会话
3. **方式**：调用 AI 生成简短标题（< 20 字）

### 4.2 实现

#### 4.2.1 添加 API 端点

创建 `/api/chat-sessions/generate-titles/route.ts`：
```typescript
export async function POST(request: Request) {
  const sessions = await db.select().from(conversations)
    .where(eq(conversations.title, "新对话"))
    .limit(10);

  for (const session of sessions) {
    const title = await generateTitle(session.messages);
    await db.update(conversations)
      .set({ title })
      .where(eq(conversations.id, session.id));
  }

  return NextResponse.json({ updated: sessions.length });
}
```

#### 4.2.2 前端触发

在 `useChatStore.loadSessions` 后，如果有默认标题会话，触发批量生成。

---

## 5. 会话自动索引

### 5.1 方案：混合模式

1. **实时索引**：对话结束时触发（主要）
2. **批量兜底**：定时处理未索引会话（容错）

### 5.2 实现

#### 5.2.1 实时索引

修改 `useChatSession.ts` 的 `onFinish`：
```typescript
onFinish: async ({ messages }) => {
  if (sessionId) {
    await persistMessages(sessionId, messages);
    // 触发索引
    fetch("/api/chat-sessions/index", {
      method: "POST",
      body: JSON.stringify({ sessionId, messages }),
    }).catch(console.error);
  }
}
```

#### 5.2.2 索引 API

创建 `/api/chat-sessions/index/route.ts`，调用现有的 `enqueueConversationIndex`。

#### 5.2.3 Worker

独立进程运行 `conversation-indexing` worker。

---

## 6. 实施顺序

| 优先级 | 任务 | 预计时间 |
|:---:|------|:---|
| P0 | 代码质量提升 | 1h |
| P1 | 用户认证集成 | 2h |
| P2 | 会话自动索引 | 2h |
| P3 | 标题自动生成 | 1h |

---

## 7. 验收标准

- [ ] `COMMANDS` 无重复定义
- [ ] 类型检查通过（无 `currentSessionId` 错误）
- [ ] `UserAvatar` 显示真实用户信息
- [ ] 未登录时显示登录引导
- [ ] 对话结束后自动触发索引
- [ ] 后台 Worker 独立运行
- [ ] 批量生成标题功能正常

---

## 8. 风险与依赖

| 风险 | 缓解措施 |
|------|----------|
| AI 生成标题成本高 | 限制批量数量，使用轻量模型 |
| 索引 Worker 崩溃 | 添加健康检查和自动重启 |
| 用户会话丢失 | 添加本地缓存 fallback |
