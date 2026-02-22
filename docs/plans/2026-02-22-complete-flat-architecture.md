# NexusNote 完全扁平化架构实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task。

**目标：** 彻底移除 `ui/` 目录，将所有内容按性质分类平铺到 `components/` 和 `lib/`，消除所有嵌套子目录。

**架构：**
- UI 组件 → `components/{chat,auth,editor}/` （平铺，无 components/hooks/stores 子目录）
- AI 工具/agents → `lib/ai/` （保持 tools/agents 子目录以组织功能）
- 类型定义 → 合并到 `types/`

**技术栈：** Next.js 16, TypeScript, pnpm

---

## 当前状态

43 个文件需要迁移：

```
ui/
├── ai/           # 18 files - 逻辑代码，去 lib/ai/
├── auth/         # 5 files - UI组件，去 components/auth/
├── chat/         # 11 files - UI组件，去 components/chat/
└── editor/       # 9 files - UI组件，去 components/editor/
```

---

## 扁平化映射规则

| 源结构 | 目标位置 | 处理方式 |
|--------|----------|----------|
| `ui/chat/components/*` | `components/chat/*` | 平铺 |
| `ui/chat/hooks/*` | `components/chat/*` | 平铺（hooks 用 `use` 前缀区分） |
| `ui/chat/stores/*` | `components/chat/*` | 平铺（stores 用 `use` 前缀区分） |
| `ui/chat/types/*` | `types/chat.ts` | 合并 |
| `ui/auth/components/*` | `components/auth/*` | 平铺 |
| `ui/auth/stores/*` | `components/auth/*` | 平铺 |
| `ui/editor/components/*` | `components/editor/*` | 平铺 |
| `ui/editor/extensions/*` | `components/editor/*` | 平铺 |
| `ui/editor/stores/*` | `components/editor/*` | 平铺 |
| `ui/ai/tools/*` | `lib/ai/tools/` | 保持子目录 |
| `ui/ai/agents/*` | `lib/ai/agents/` | 保持 |
| `ui/ai/validation/*` | `lib/ai/validation.ts` | 单文件 |
| `ui/ai/types/*` | `types/ai.ts` | 合并 |
| `ui/ai/lib/*` | `lib/utils.ts` | 合并 diff.ts |

---

## 阶段 1: 迁移 ui/chat/

### Task 1: 创建 components/chat/ 目录并平铺所有文件

**Files:**
- Create: `components/chat/` directory
- Move: `ui/chat/components/*` → `components/chat/*`
- Move: `ui/chat/hooks/*` → `components/chat/*`
- Move: `ui/chat/stores/*` → `components/chat/*`
- Move: `ui/chat/types/*` → `types/chat.ts`
- Move: `ui/chat/index.ts` → `components/chat/index.ts`

**Step 1: 创建目标目录**

```bash
mkdir -p web/components/chat
```

**Step 2: 移动所有组件文件**

```bash
# 组件
mv web/ui/chat/components/ChatPanel.tsx web/components/chat/
mv web/ui/chat/components/ChatLayout.tsx web/components/chat/
mv web/ui/chat/components/ChatMessage.tsx web/components/chat/
mv web/ui/chat/components/ChatHistory.tsx web/components/chat/
mv web/ui/chat/components/CommandMenu.tsx web/components/chat/
mv web/ui/chat/components/TransitionOverlay.tsx web/components/chat/
```

**Step 3: 移动 hooks**

```bash
mv web/ui/chat/hooks/useChatSession.ts web/components/chat/
```

**Step 4: 移动 stores**

```bash
mv web/ui/chat/stores/useChatStore.ts web/components/chat/
mv web/ui/chat/stores/usePendingChatStore.ts web/components/chat/
mv web/ui/chat/stores/useTransitionStore.ts web/components/chat/
```

**Step 5: 处理 types - 创建 types/chat.ts**

```bash
# 读取 types 内容
cat web/ui/chat/types/index.ts
```

然后创建 `web/types/chat.ts` 包含这些类型定义。

**Step 6: 创建新的 components/chat/index.ts**

```typescript
// Components
export { ChatPanel } from './ChatPanel';
export { ChatLayout } from './ChatLayout';
export { ChatMessage } from './ChatMessage';
export { ChatHistory } from './ChatHistory';
export { CommandMenu } from './CommandMenu';
export { TransitionOverlay } from './TransitionOverlay';

// Hooks
export { useChatSession } from './useChatSession';

// Stores
export { useChatStore } from './useChatStore';
export { usePendingChatStore } from './usePendingChatStore';
export { useTransitionStore } from './useTransitionStore';
```

**Step 7: 删除空的 ui/chat 目录**

```bash
rm -rf web/ui/chat
```

**Step 8: 提交**

```bash
git add web/components/web/types web/ui
git commit -m "refactor: flatten ui/chat/ to components/chat/"
```

---

### Task 2: 更新所有 @/ui/chat 引用

**Files:**
- Modify: All files importing from `@/ui/chat`

**Step 1: 查找所有引用**

```bash
grep -r "from '@/ui/chat" web --include="*.ts" --include="*.tsx"
```

**Step 2: 批量替换**

```bash
find web -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' 's|from '\''@/ui/chat'\''|from "@/components/chat"|g' {} +
```

**Step 3: 更新 types 引用**

```bash
find web -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' 's|from '\''@/ui/chat/types'\''|from "@/types/chat"|g' {} +
```

**Step 4: 验证类型检查**

```bash
cd web && pnpm typecheck
```

**Step 5: 提交**

```bash
git add web
git commit -m "refactor: update imports from ui/chat to components/chat"
```

---

## 阶段 2: 迁移 ui/auth/

### Task 3: 创建 components/auth/ 并平铺文件

**Files:**
- Create: `components/auth/`
- Move: `ui/auth/components/*` → `components/auth/*`
- Move: `ui/auth/stores/*` → `components/auth/*`
- Move: `ui/auth/index.ts` → `components/auth/index.ts`

**Step 1: 创建目录并移动文件**

```bash
mkdir -p web/components/auth
mv web/ui/auth/components/* web/components/auth/
mv web/ui/auth/stores/* web/components/auth/
```

**Step 2: 创建 index.ts**

```typescript
// Components
export { AuthSync } from './AuthSync';
export { SessionProvider } from './SessionProvider';

// Stores
export { useAuthStore } from './useAuthStore';
```

**Step 3: 删除 ui/auth**

```bash
rm -rf web/ui/auth
```

**Step 4: 提交**

```bash
git add web/components web/ui
git commit -m "refactor: flatten ui/auth/ to components/auth/"
```

---

### Task 4: 更新 @/ui/auth 引用

**Step 1: 查找并替换**

```bash
grep -r "from '@/ui/auth" web --include="*.ts" --include="*.tsx"
find web -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' 's|from '\''@/ui/auth'\''|from "@/components/auth"|g' {} +
```

**Step 2: 验证**

```bash
cd web && pnpm typecheck
```

**Step 3: 提交**

```bash
git add web && git commit -m "refactor: update imports from ui/auth to components/auth"
```

---

## 阶段 3: 迁移 ui/editor/

### Task 5: 创建 components/editor/ 并平铺文件

**Files:**
- Create: `components/editor/`
- Move: `ui/editor/components/*` → `components/editor/*`
- Move: `ui/editor/extensions/*` → `components/editor/*`
- Move: `ui/editor/stores/*` → `components/editor/*`
- Move: `ui/editor/index.ts` → `components/editor/index.ts`

**Step 1: 创建目录并移动**

```bash
mkdir -p web/components/editor
mv web/ui/editor/components/* web/components/editor/
mv web/ui/editor/extensions/* web/components/editor/
mv web/ui/editor/stores/* web/components/editor/
```

**Step 2: 创建 index.ts**

```typescript
// Components
export { Editor } from './Editor';
export { CollaborationEditor } from './CollaborationEditor';
export { AISuggestions } from './AISuggestions';
export { AIMenu } from './AIMenu';
export { Snapshot } from './Snapshot';
export { ExportImport } from './ExportImport';
export { Comments } from './Comments';

// Extensions
export { Callout } from './Callout';

// Stores
export { useEditorStore } from './useEditorStore';
```

**Step 3: 删除 ui/editor**

```bash
rm -rf web/ui/editor
```

**Step 4: 提交**

```bash
git add web/components web/ui
git commit -m "refactor: flatten ui/editor/ to components/editor/"
```

---

### Task 6: 更新 @/ui/editor 引用

**Step 1: 查找并替换**

```bash
grep -r "from '@/ui/editor" web --include="*.ts" --include="*.tsx"
find web -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' 's|from '\''@/ui/editor'\''|from "@/components/editor"|g' {} +
```

**Step 2: 验证**

```bash
cd web && pnpm typecheck
```

**Step 3: 提交**

```bash
git add web && git commit -m "refactor: update imports from ui/editor to components/editor"
```

---

## 阶段 4: 迁移 ui/ai/

### Task 7: 创建 lib/ai/ 结构并迁移

**Files:**
- Create: `lib/ai/tools/`, `lib/ai/agents/`, `lib/ai/validation.ts`
- Move: `ui/ai/tools/*` → `lib/ai/tools/`
- Move: `ui/ai/agents/*` → `lib/ai/agents/`
- Move: `ui/ai/validation/*` → `lib/ai/validation.ts`
- Create: `types/ai.ts` (合并 types)

**Step 1: 创建目录**

```bash
mkdir -p web/lib/ai/tools
mkdir -p web/lib/ai/agents
```

**Step 2: 移动 tools (保持子目录)**

```bash
cp -r web/ui/ai/tools/chat web/lib/ai/tools/
cp -r web/ui/ai/tools/editor web/lib/ai/tools/
cp -r web/ui/ai/tools/learning web/lib/ai/tools/
cp -r web/ui/ai/tools/rag web/lib/ai/tools/
mv web/ui/ai/tools/index.ts web/lib/ai/tools/
```

**Step 3: 移动 agents**

```bash
mv web/ui/ai/agents/* web/lib/ai/agents/
```

**Step 4: 移动 validation**

```bash
mv web/ui/ai/validation/index.ts web/lib/ai/validation.ts
```

**Step 5: 处理 lib/diff.ts**

```bash
# 读取 diff.ts 内容
cat web/ui/ai/lib/diff.ts
```

将 diff 函数合并到 `web/lib/utils.ts`

**Step 6: 创建 types/ai.ts**

合并 `ui/ai/types/index.ts` 内容到 `web/types/ai.ts`

**Step 7: 创建 lib/ai/index.ts**

```typescript
// Tools
export * from './tools';

// Agents
export * from './agents';

// Validation
export { sanitizeInput, validateRequest, MessageSchema, ChatRequestSchema } from './validation';
export type { ChatRequest, Intent } from './validation';
```

**Step 8: 删除 ui/ai**

```bash
rm -rf web/ui/ai
```

**Step 9: 提交**

```bash
git add web/lib web/types web/ui
git commit -m "refactor: move ui/ai to lib/ai, merge types"
```

---

### Task 8: 更新 @/ui/ai 引用

**Step 1: 查找并替换**

```bash
grep -r "from '@/ui/ai" web --include="*.ts" --include="*.tsx"
find web -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' 's|from '\''@/ui/ai'\''|from "@/lib/ai"|g' {} +
```

**Step 2: 验证**

```bash
cd web && pnpm typecheck
```

**Step 3: 提交**

```bash
git add web && git commit -m "refactor: update imports from ui/ai to lib/ai"
```

---

## 阶段 5: 清理

### Task 9: 删除空的 ui/ 目录

**Step 1: 确认 ui/ 为空**

```bash
ls -la web/ui/
```

**Step 2: 删除 ui/ 目录**

```bash
rm -rf web/ui
```

**Step 3: 提交**

```bash
git add web/ui
git commit -m "refactor: remove empty ui/ directory"
```

---

## 阶段 6: 更新 tsconfig.json

### Task 10: 移除 @/ui/* 路径

**Files:**
- Modify: `tsconfig.json`

**Step 1: 检查当前 paths**

```bash
cat web/tsconfig.json | grep -A20 "paths"
```

**Step 2: 确认不需要 @/ui 路径**

当前 tsconfig.json 应该已经没有 `@/ui/*` 路径（之前已更新为扁平化）。

---

## 阶段 7: 验证

### Task 11: 全面验证

**Step 1: 类型检查**

```bash
cd web && pnpm typecheck
```

Expected: 无错误

**Step 2: Lint**

```bash
cd web && pnpm lint
```

Expected: 无阻塞性错误

**Step 3: 构建**

```bash
cd web && pnpm build
```

Expected: 构建成功

**Step 4: 最终提交**

```bash
git add .
git commit -m "refactor: complete flat architecture - ui/ fully migrated"
```

---

## 最终结构

```
web/
├── components/
│   ├── chat/           # 平铺: ChatPanel.tsx, useChatSession.ts, useChatStore.ts 等
│   ├── auth/           # 平铺: AuthSync.tsx, SessionProvider.tsx, useAuthStore.ts
│   ├── editor/         # 平铺: Editor.tsx, Callout.ts, useEditorStore.ts
│   ├── shared/         # shared components
│   └── ui/             # base UI components
├── lib/
│   ├── ai/
│   │   ├── tools/      # chat/, editor/, learning/, rag/
│   │   ├── agents/
│   │   ├── validation.ts
│   │   └── index.ts
│   ├── rag/            # RAG 服务
│   └── ...
├── types/
│   ├── ai.ts           # AI 相关类型
│   ├── chat.ts         # Chat 相关类型
│   └── index.ts
└── ui/                 # 已删除
```

---

## 导入路径变更

| 旧路径 | 新路径 |
|--------|--------|
| `@/ui/chat` | `@/components/chat` |
| `@/ui/auth` | `@/components/auth` |
| `@/ui/editor` | `@/components/editor` |
| `@/ui/ai` | `@/lib/ai` |
| `@/ui/chat/types` | `@/types/chat` |
| `@/ui/ai/types` | `@/types/ai` |
