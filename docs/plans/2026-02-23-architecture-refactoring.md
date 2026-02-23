# 架构重构实施计划 (简化版)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 清理项目架构问题，统一命名规范，优化目录结构。

**Architecture:** 渐进式重构，分阶段执行，每个阶段独立验证。

**Tech Stack:** Next.js 16, React 19, TypeScript, Zustand 5.0

---

## 问题概述

### 高优先级问题

| 问题 | 位置 | 严重程度 | 解决方案 |
|------|------|----------|----------|
| Store 放在 components/ | `components/*/use*.ts` | 高 | 移到 `stores/` 统一管理 |
| 私有组件混在 app/ | `app/_components/` | 中 | 移到 `components/shared/home/` |
| 命名不一致 | `demo-client.tsx` vs `FlashcardsClient.tsx` | 中 | 统一为 PascalCase |

### 中优先级问题

| 问题 | 位置 | 严重程度 | 解决方案 |
|------|------|----------|----------|
| 类型定义重叠 | `types/index.ts` 与其他文件 | 中 | 清理重叠，统一导出 |

### 低优先级问题

| 问题 | 位置 | 严重程度 | 解决方案 |
|------|------|----------|----------|
| 测试代码混在源码 | `app/demo/` | 低 | 可选删除 |

### 暂不执行

- ~~添加无障碍支持 (prefers-reduced-motion)~~ - 用户要求先不用

---

## 阶段 1: Store 重构 (高优先级)

### Task 1: 创建 stores 目录结构

**目标:** 将 Zustand store 从 components/ 移到独立的 stores/ 目录

**同时进行: 优化 components/ 目录结构，按方案1重新组织**

**最终目标结构:**

```
components/
├── home/                    ← 首页专用组件
│   ├── HeroInput.tsx
│   ├── RecentCard.tsx
│   ├── MarkdownRenderer.tsx  ← 或移到 common/
│   └── index.ts
│
├── shared/                  ← 真正通用的组件
│   ├── layout/              ← 布局组件
│   │   ├── MobileNav.tsx
│   │   ├── FloatingHeader.tsx
│   │   ├── AppSidebar.tsx
│   │   ├── UserAvatar.tsx
│   │   └── index.ts
│   └── common/              ← 通用渲染组件
│       ├── MarkdownRenderer.tsx
│       ├── MarkdownRenderer.server.tsx
│       └── index.ts
│
├── ui/                      ← 通用 UI 组件
│   ├── Button.tsx
│   ├── Toast.tsx
│   ├── Separator.tsx
│   └── ...
│
├── chat/                    ← 聊天组件
├── auth/                    ← 认证组件
└── editor/                  ← 编辑器组件

stores/                      ← 全局状态管理 (新建)
├── chat.ts
├── auth.ts
└── editor.ts
```

**Files:**
- Create: `stores/index.ts`
- Create: `stores/chat.ts`
- Create: `stores/auth.ts`
- Create: `stores/editor.ts`
- Modify: 各组件中的 import 语句

**Step 1: 创建 stores/index.ts (统一导出)**

```typescript
/**
 * Zustand Stores 统一导出
 *
 * 全局状态管理 - 跨页面共享的状态
 */

export { useChatStore } from './chat';
export { useAuthStore } from './auth';
export { useEditorStore } from './editor';
```

**Step 2: 创建 stores/chat.ts**

从 `components/chat/useChatStore.ts` 移动内容：

```typescript
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

interface ChatState {
  messages: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
  }>;
  sessionId: string | null;
  addMessage: (message: Omit<ChatState['messages'][0], 'id'>) => void;
  setSessionId: (id: string) => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatState>()(
  devtools(
    persist(
      (set) => ({
        messages: [],
        sessionId: null,
        addMessage: (message) =>
          set((state) => ({
            messages: [...state.messages, { ...message, id: crypto.randomUUID() }],
          })),
        setSessionId: (id) => set({ sessionId: id }),
        clearMessages: () => set({ messages: [], sessionId: null }),
      }),
      { name: 'chat-store' }
    )
  )
);
```

**Step 3: 创建 stores/auth.ts**

从 `components/auth/useAuthStore.ts` 移动内容并保持原有逻辑。

**Step 4: 创建 stores/editor.ts**

从 `components/editor/useEditorStore.ts` 移动内容并保持原有逻辑。

**Step 5: 更新所有组件的 import**

```bash
# 查找所有旧引用
grep -r "from.*useChatStore" components/ --include="*.ts" --include="*.tsx"

# 替换
# 从: import { useChatStore } from './useChatStore'
# 到: import { useChatStore } from '@/stores/chat'
```

**Step 6: 删除旧的 store 文件**

```bash
rm components/chat/useChatStore.ts
rm components/auth/useAuthStore.ts
rm components/editor/useEditorStore.ts
```

**Step 7: 验证**

```bash
pnpm run typecheck
pnpm run build
```

**Step 8: 提交**

```bash
git add stores/ components/
git commit -m "refactor: move Zustand stores to stores/ directory"
```

---

### Task 2: 重命名页面级 Client Components

**目标:** 统一命名为 PascalCase

**Files to rename:**

```bash
# 当前 → 目标
app/demo/demo-client.tsx → app/demo/DemoClient.tsx
app/interview/interview-client.tsx → app/interview/InterviewClient.tsx
app/flashcards/flashcards-client.tsx → app/flashcards/FlashcardsClient.tsx
```

**Step 1: 重命名 demo-client.tsx**

```bash
git mv app/demo/demo-client.tsx app/demo/DemoClient.tsx
```

**Step 2: 更新 app/demo/page.tsx 中的 import**

```tsx
// 从: import { DemoClient } from "./demo-client";
// 到: import { DemoClient } from "./DemoClient";
```

**Step 3: 重命名 interview-client.tsx**

```bash
git mv app/interview/interview-client.tsx app/interview/InterviewClient.tsx
```

**Step 4: 更新 app/interview/page.tsx 中的 import**

**Step 5: 重命名 flashcards-client.tsx**

```bash
git mv app/flashcards/flashcards-client.tsx app/flashcards/FlashcardsClient.tsx
```

**Step 6: 更新 app/flashcards/page.tsx 中的 import**

**Step 7: 验证**

```bash
pnpm run typecheck
pnpm run build
```

**Step 8: 提交**

```bash
git add app/
git commit -m "refactor: rename Client Components to PascalCase"
```

---

## 阶段 2: 目录结构重组 (中优先级)

### Task 3: 按使用场景重新组织 components/

**目标:** 解决 `shared/home/` 语义混淆问题

**问题:** `shared/home/` 混合了首页专用组件和通用组件

**最终结构:**

```
components/
├── home/                    ← 首页专用组件
│   ├── HeroInput.tsx
│   ├── RecentCard.tsx
│   ├── RecentSectionServer.tsx  ← 从 app/_components 移入
│   ├── MarkdownRenderer.tsx  ← 或移到 common/
│   └── index.ts
│
├── common/                  ← 通用渲染组件
│   ├── MarkdownRenderer.tsx
│   ├── MarkdownRenderer.server.tsx
│   └── index.ts
│
├── shared/                  ← 通用布局组件
│   ├── layout/
│   │   ├── MobileNav.tsx      ← 从 components/shared/layout/ 移入
│   │   ├── FloatingHeader.tsx
│   │   ├── AppSidebar.tsx
│   │   ├── UserAvatar.tsx
│   │   └── index.ts
│   └── index.ts              ← 统一导出
│
├── ui/                      ← 通用 UI 组件
├── chat/
├── auth/
└── editor/
```

**Step 1: 创建新目录**

```bash
mkdir -p components/home
mkdir -p components/common
mkdir -p components/shared/layout
```

**Step 2: 移动首页专用组件**

```bash
git mv components/shared/home/HeroInput.tsx components/home/HeroInput.tsx
git mv components/shared/home/RecentCard.tsx components/home/RecentCard.tsx
```

**Step 3: 移动通用渲染组件**

```bash
git mv components/shared/home/MarkdownRenderer.tsx components/common/MarkdownRenderer.tsx
git mv components/shared/home/MarkdownRenderer.server.tsx components/common/MarkdownRenderer.server.tsx
```

**Step 4: 移动 app/_components/**

```bash
git mv app/_components/RecentSectionServer.tsx components/home/RecentSectionServer.tsx
rmdir app/_components
```

**Step 5: 创建 index.ts 文件**

```typescript
// components/home/index.ts
export { HeroInput } from './HeroInput';
export { RecentCard } from './RecentCard';
export { RecentSectionServer } from './RecentSectionServer';

// components/common/index.ts
export { MarkdownRenderer } from './MarkdownRenderer';
export { MarkdownRendererServer } from './MarkdownRenderer.server';

// components/shared/layout/index.ts
export { MobileNav } from './MobileNav';
export { FloatingHeader } from './FloatingHeader';
export { AppSidebar } from './AppSidebar';
export { UserAvatar } from './UserAvatar';
```

**Step 6: 批量更新所有引用**

```bash
# 搜索并替换所有旧路径
# components/shared/home/HeroInput → components/home/HeroInput
# components/shared/home/RecentCard → components/home/RecentCard
# components/shared/home/MarkdownRenderer → components/common/MarkdownRenderer
# components/shared/layout/* → components/shared/layout/*
```

**Step 7: 清理旧目录**

```bash
rmdir components/shared/home 2>/dev/null || true
```

**Step 8: 验证**

```bash
pnpm run typecheck
```

**Step 9: 提交**

```bash
git add components/
git commit -m "refactor: reorganize components/ by use case (home/common/shared)"
```

---

## 阶段 3: 类型定义整理 (中优先级)

### Task 3: 移动 _components 到正确位置

**目标:** 将 `app/_components/RecentSectionServer.tsx` 移到 `components/shared/home/`

**Files:**
- Move: `app/_components/RecentSectionServer.tsx` → `components/shared/home/RecentSectionServer.tsx`
- Modify: `app/page.tsx` (更新 import)
- Delete: `app/_components/` 目录

**Step 1: 移动文件**

```bash
git mv app/_components/RecentSectionServer.tsx components/shared/home/RecentSectionServer.tsx
```

**Step 2: 更新 app/page.tsx 的 import**

```tsx
// 从: import { RecentSectionServer } from "./_components/RecentSectionServer";
// 到: import { RecentSectionServer } from "@/components/shared/home/RecentSectionServer";
```

**Step 3: 删除空目录**

```bash
rmdir app/_components
```

**Step 4: 验证**

```bash
pnpm run build
```

**Step 5: 提交**

```bash
git add app/ components/
git commit -m "refactor: move _components to components/shared/home"
```

---

## 阶段 3: 类型定义整理 (中优先级)

### Task 4: 清理 types/index.ts 重叠

**目标:** 移除 types/index.ts 中与其他文件重叠的类型，只保留导出

**当前状态分析:**
- `types/index.ts` - 包含通用类型，可能与 chat.ts 等有重叠
- `types/chat.ts` - 聊天专用类型
- `types/ai.ts` - AI 专用类型
- `types/auth.ts` - Auth 专用类型
- `types/editor.ts` - 编辑器专用类型

**Step 1: 读取 types/index.ts 内容**

检查是否有重叠定义。

**Step 2: 重写 types/index.ts 为纯导出文件**

```typescript
/**
 * 类型定义统一导出
 *
 * 各功能模块的类型定义在各自的文件中
 * 此文件仅作为统一导出入口
 */

// AI 相关
export * from './ai';

// Auth 相关
export * from './auth';

// Chat 相关
export * from './chat';

// Editor 相关
export * from './editor';

// 通用类型（如果有）
export type { /* 只放真正通用的类型 */ } from './index-base';
```

**Step 3: 如果有重叠定义，移到对应文件**

例如，如果 `index.ts` 中有 `ChatMessage` 类型，应该只在 `chat.ts` 中保留。

**Step 4: 验证**

```bash
pnpm run typecheck
```

**Step 5: 提交**

```bash
git add types/
git commit -m "refactor: clean up types index, remove duplicates"
```

---

## 阶段 3: 可选清理 (低优先级)

### Task 5: 移除或移动 demo 页面

**目标:** 决定 demo 页面的去留

**选项 A: 保留但重命名**

如果 demo 用于展示功能，重命名为更清晰的名称：

```bash
git mv app/demo app/playground
# 或
git mv app/demo app/showcase
```

**选项 B: 完全移除**

```bash
git rm -r app/demo
```

**根据项目需求决定是否执行此任务。**

---

## 实施检查清单

### 阶段 1: Store 重构
- [ ] 创建 stores/index.ts
- [ ] 创建 stores/chat.ts
- [ ] 创建 stores/auth.ts
- [ ] 创建 stores/editor.ts
- [ ] 更新所有组件的 import
- [ ] 删除旧 store 文件
- [ ] 验证 typecheck
- [ ] 验证 build
- [ ] 提交

### 阶段 2: 命名统一
- [ ] 重命名 demo-client.tsx → DemoClient.tsx
- [ ] 重命名 interview-client.tsx → InterviewClient.tsx
- [ ] 重命名 flashcards-client.tsx → FlashcardsClient.tsx
- [ ] 更新所有 import
- [ ] 验证 typecheck
- [ ] 验证 build
- [ ] 提交

### 阶段 3: 清理 _components
- [ ] 移动 RecentSectionServer.tsx
- [ ] 更新 app/page.tsx import
- [ ] 删除空目录
- [ ] 验证 build
- [ ] 提交

### 阶段 4: 类型定义整理
- [ ] 分析 types/index.ts 重叠
- [ ] 重写为纯导出文件
- [ ] 移除重复定义
- [ ] 验证 typecheck
- [ ] 提交

---

## 验证方式

### 构建验证
```bash
pnpm run typecheck  # 应无错误
pnpm run build       # 应成功构建
```

### 运行时验证
- [ ] 所有页面正常加载
- [ ] Chat 功能正常
- [ ] Auth 功能正常
- [ ] 动画流畅（默认情况）

---

## 备注

### 暂不执行的功能
- 无障碍支持 (prefers-reduced-motion) - 用户要求先不用
- [ ] 动画禁用（系统设置减少动画时）

### 无障碍验证
1. 打开系统设置 → 辅助功能 → 显示 → 减少动画
2. 刷新应用页面
3. 确认动画被禁用或简化为淡入淡出

---

## 参考资料

- [Zustand 最佳实践](https://docs.pmnd.rs/zustand/)
- [WCAG 无障碍标准](https://www.w3.org/WAI/WCAG21/quickref/)
- [prefers-reduced-motion MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)

---

**计划状态:** ✅ 已完成，等待执行
