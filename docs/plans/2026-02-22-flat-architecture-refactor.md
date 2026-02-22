# NexusNote 扁平化架构重构实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**目标：** 将 NexusNote 从多层嵌套架构重构为 Next.js 现代扁平化架构，简化目录结构，提升可维护性。

**架构：** 采用 Next.js 16 现代实践 - 扁平化 `app/`, `components/`, `lib/`, `config/` 结构，移除 `infrastructure/`, `services/`, `ui/` 嵌套层级。

**技术栈：** Next.js 16, TypeScript, Zustand, Drizzle ORM, Vercel AI SDK 6.x

---

## 当前状态分析

**需要处理的目录：**
| 目录 | 文件数 | 操作 |
|------|--------|------|
| `ui/ui/` | 2 文件 | 移动到 `components/ui/` |
| `ui/home/` | 5 文件 | 移动到 `components/shared/` |
| `ui/layout/` | 5 文件 | 移动到 `components/shared/` |
| `stores/` | 1 文件 | 删除（已废弃） |
| `lib/ai/` | 4 文件 | 合并到 `lib/ai.ts` |
| `lib/fsrs/` | 1 文件 | 合并到 `lib/algorithm.ts` |
| `lib/queue/` | 2 文件 | 合并到 `lib/queue.ts` |
| `lib/ui/` | 6 文件 | 移动到 `components/ui/` |
| `infrastructure/` | 3 文件 | AI 配置移到 `lib/ai.ts`，queue 配置移到 `lib/queue.ts` |
| `services/` | 9 文件 | RAG 移到 `lib/rag.ts`，Profile 移到 `lib/profile.ts` |

---

## 最终目标结构

```
web/
├── app/                    # Next.js App Router
│   ├── api/                # API Routes
│   ├── auth/               # Auth Pages
│   ├── chat/               # Chat Pages
│   ├── course/             # Course Pages
│   ├── editor/             # Editor Pages
│   ├── flashcards/         # Flashcards Pages
│   ├── interview/          # Interview Pages
│   ├── demo/               # Demo Page
│   ├── page.tsx            # Home
│   ├── layout.tsx          # Root Layout
│   └── globals.css         # Global Styles
├── components/             # 所有组件和 hooks
│   ├── ui/                 # 基础 UI 组件（Button, Toast, Tooltip 等）
│   ├── editor/             # Editor 组件 + hooks + stores
│   ├── chat/               # Chat 组件 + hooks + stores
│   ├── auth/               # Auth 组件 + hooks + stores
│   ├── ai/                 # AI 组件 + tools
│   └── shared/             # 共享组件（layouts, home components）
├── lib/                    # 所有非 UI 代码
│   ├── db.ts               # 数据库客户端 + schema 导出
│   ├── ai.ts               # AI 工具（CircuitBreaker, PromptRegistry, safeGenerateObject）+ aiProvider
│   ├── algorithm.ts        # FSRS 算法
│   ├── queue.ts            # BullMQ 队列
│   ├── rag.ts              # RAG 服务（合并 services/rag）
│   ├── profile.ts          # Profile 服务（合并 services/profile）
│   └── utils.ts            # cn 工具函数
├── config/                 # 环境配置
│   └── env.ts              # 环境变量
├── types/                  # 类型定义
│   └── index.ts
├── db/                     # 数据库
│   ├── schema.ts           # Drizzle Schema
│   ├── drizzle.config.ts   # Drizzle 配置
│   └── migrate.ts          # 迁移脚本
├── infrastructure/         # 删除
├── services/               # 删除
├── stores/                 # 删除
├── party/                  # PartyKit（保持不变）
├── public/                 # 静态资源
├── next.config.js
├── package.json
├── tsconfig.json
└── biome.json
```

---

## 导入路径映射

| 旧路径 | 新路径 |
|--------|--------|
| `@/lib/ai` | `@/lib/ai` |
| `@/lib/fsrs` | `@/lib/algorithm` |
| `@/lib/queue` | `@/lib/queue` |
| `@/lib/ui` | `@/components/ui` |
| `@/infrastructure/ai/provider` | `@/lib/ai` |
| `@/infrastructure/queue` | `@/lib/queue` |
| `@/services/rag` | `@/lib/rag` |
| `@/services/profile` | `@/lib/profile` |
| `@/ui/home/*` | `@/components/shared/*` |
| `@/ui/layout/*` | `@/components/shared/*` |
| `@/stores` | `@/components/{auth,editor}` |

---

## 实施步骤

### 阶段 1: 清理遗留文件

#### Task 1: 删除遗留的 stores 目录

**Files:**
- Delete: `web/stores/`

**Step 1: 检查是否有引用**

```bash
grep -r "from '@/stores'" web --include="*.ts" --include="*.tsx"
```

Expected: 无结果（已验证）

**Step 2: 删除目录**

```bash
rm -rf web/stores
```

**Step 3: 提交**

```bash
git add web/stores
git commit -m "refactor: remove deprecated stores/ directory"
```

---

#### Task 2: 移动 ui/ui 到 components/ui

**Files:**
- Move: `web/ui/ui/components/Toast.tsx` → `web/components/ui/Toast.tsx`
- Delete: `web/ui/ui/`

**Step 1: 创建 components/ui 目录**

```bash
mkdir -p web/components/ui
```

**Step 2: 移动 Toast 组件**

```bash
mv web/ui/ui/components/Toast.tsx web/components/ui/
```

**Step 3: 删除 ui/ui 目录**

```bash
rm -rf web/ui/ui
```

**Step 4: 查找并更新所有 Toast 引用**

```bash
grep -r "Toast" web/components --include="*.tsx" --include="*.ts"
```

如有 `@/ui/ui/components/Toast` 引用，更新为 `@/components/ui`

**Step 5: 提交**

```bash
git add web/ui web/components
git commit -m "refactor: move Toast from ui/ui to components/ui, remove ui/ui nesting"
```

---

#### Task 3: 移动 ui/home 到 components/shared

**Files:**
- Move: `web/ui/home/*` → `web/components/shared/home/*`

**Step 1: 创建 components/shared 目录**

```bash
mkdir -p web/components/shared/home
```

**Step 2: 移动 home 组件**

```bash
mv web/ui/home/components/* web/components/shared/home/
```

**Step 3: 删除 ui/home 目录**

```bash
rm -rf web/ui/home
```

**Step 4: 更新 tsconfig.json 路径**

编辑 `web/tsconfig.json`，确保 `@/components/shared/*` 路径存在。

**Step 5: 查找并更新所有导入**

```bash
grep -r "from '@/ui/home'" web --include="*.tsx" --include="*.ts"
```

替换 `@/ui/home` 为 `@/components/shared/home`

**Step 6: 提交**

```bash
git add web/ui web/components web/tsconfig.json
git commit -m "refactor: move home components to components/shared/home"
```

---

#### Task 4: 移动 ui/layout 到 components/shared

**Files:**
- Move: `web/ui/layout/*` → `web/components/shared/layout/*`

**Step 1: 创建目录并移动**

```bash
mkdir -p web/components/shared/layout
mv web/ui/layout/components/* web/components/shared/layout/
```

**Step 2: 移动 ui/layout/index.ts**

```bash
mv web/ui/layout/index.ts web/components/shared/layout-index.ts
```

**Step 3: 删除 ui/layout 目录**

```bash
rm -rf web/ui/layout
```

**Step 4: 更新所有导入**

```bash
grep -r "from '@/ui/layout'" web --include="*.tsx" --include="*.ts"
```

替换 `@/ui/layout` 为 `@/components/shared/layout`

**Step 5: 提交**

```bash
git add web/ui web/components
git commit -m "refactor: move layout components to components/shared/layout"
```

---

### 阶段 2: 合并 lib 子目录

#### Task 5: 合并 lib/ai 到 lib/ai.ts

**Files:**
- Create: `web/lib/ai.ts`
- Delete: `web/lib/ai/`

**Step 1: 创建合并后的 lib/ai.ts**

创建新文件 `web/lib/ai.ts`，包含：
```typescript
// ========== Circuit Breaker ==========
// 从 lib/ai/circuit-breaker.ts 合并
export type { CircuitState } from "./circuit-breaker";
export { CircuitBreaker, type CircuitBreakerConfig } from "./circuit-breaker";

// ========== Prompt Registry ==========
// 从 lib/ai/prompt-registry.ts 合并
export { PromptRegistry, type PromptTemplate } from "./prompt-registry";

// ========== Safe Generate ==========
// 从 lib/ai/safe-generate.ts 合并
export { safeGenerateObject, type SafeGenerateOptions } from "./safe-generate";

// ========== AI Provider ==========
// 从 infrastructure/ai/provider.ts 合并
export { aiProvider } from "./ai-provider";
```

**注意：** 实际执行时需要将原文件内容复制过来，调整导出。

**Step 2: 移动 infrastructure/ai/provider.ts 到 lib/ai-provider.ts**

```bash
mv web/infrastructure/ai/provider.ts web/lib/ai-provider.ts
```

**Step 3: 更新 ai-provider.ts 中的导入**

编辑 `web/lib/ai-provider.ts`，移除 infrastructure 相关注释。

**Step 4: 删除旧目录**

```bash
rm -rf web/lib/ai
rm -rf web/infrastructure/ai
```

**Step 5: 更新所有导入**

```bash
# 查找所有引用
grep -r "from '@/infrastructure/ai" web --include="*.ts" --include="*.tsx"
grep -r "from '@/lib/ai" web --include="*.ts" --include="*.tsx"
```

替换为 `from "@/lib/ai"`

**Step 6: 提交**

```bash
git add web/lib web/infrastructure
git commit -m "refactor: merge lib/ai + infrastructure/ai into lib/ai.ts"
```

---

#### Task 6: 合并 lib/fsrs 到 lib/algorithm.ts

**Files:**
- Move: `web/lib/fsrs/index.ts` → `web/lib/algorithm.ts`
- Delete: `web/lib/fsrs/`

**Step 1: 移动并重命名**

```bash
mv web/lib/fsrs/index.ts web/lib/algorithm.ts
```

**Step 2: 删除空目录**

```bash
rm -rf web/lib/fsrs
```

**Step 3: 更新所有导入**

```bash
grep -r "from '@/lib/fsrs'" web --include="*.ts" --include="*.tsx"
```

替换 `@/lib/fsrs` 为 `@/lib/algorithm`

**Step 4: 提交**

```bash
git add web/lib
git commit -m "refactor: rename lib/fsrs to lib/algorithm.ts"
```

---

#### Task 7: 合并 lib/queue 到 lib/queue.ts

**Files:**
- Create: `web/lib/queue.ts`
- Delete: `web/lib/queue/`, `web/infrastructure/queue/`

**Step 1: 创建 lib/queue.ts**

合并以下内容到 `web/lib/queue.ts`:
- `lib/queue/index.ts` 的导出
- `lib/queue/queues/conversation-indexing.ts` 的实现
- `infrastructure/queue/index.ts` 的 queueConfig

**Step 2: 删除旧目录**

```bash
rm -rf web/lib/queue
rm -rf web/infrastructure/queue
```

**Step 3: 更新所有导入**

```bash
grep -r "from '@/lib/queue'" web --include="*.ts" --include="*.tsx"
```

**Step 4: 提交**

```bash
git add web/lib web/infrastructure
git commit -m "refactor: merge lib/queue + infrastructure/queue into lib/queue.ts"
```

---

#### Task 8: 移动 lib/ui 到 components/ui

**Files:**
- Move: `web/lib/ui/*` → `web/components/ui/*`
- Delete: `web/lib/ui/`

**Step 1: 移动 UI 组件**

```bash
mv web/lib/ui/components/* web/components/ui/
mv web/lib/ui/utils.ts web/lib/utils.ts
```

**Step 2: 删除空目录**

```bash
rm -rf web/lib/ui
```

**Step 3: 更新所有导入**

```bash
grep -r "from '@/lib/ui'" web --include="*.tsx" --include="*.ts"
```

替换 `@/lib/ui` 为 `@/components/ui`

**Step 4: 提交**

```bash
git add web/lib web/components
git commit -m "refactor: move lib/ui components to components/ui"
```

---

### 阶段 3: 合并 services 到 lib

#### Task 9: 合并 services/rag 到 lib/rag.ts

**Files:**
- Create: `web/lib/rag.ts`
- Delete: `web/services/rag/`

**Step 1: 读取所有 RAG 服务文件**

```bash
cat web/services/rag/chunker.ts
cat web/services/rag/hybrid-search.ts
cat web/services/rag/query-rewriter.ts
cat web/services/rag/semantic-chunker.ts
cat web/services/rag/index.ts
```

**Step 2: 创建合并后的 lib/rag.ts**

将所有 RAG 服务合并到一个文件中，使用清晰的注释分隔：
```typescript
// ========== Types ==========
// ...

// ========== Chunker ==========
// 从 services/rag/chunker.ts 合并
export { chunkDocument, indexDocument } from "./chunker";

// ========== Hybrid Search ==========
// 从 services/rag/hybrid-search.ts 合并
export { hybridSearch } from "./hybrid-search";

// ...
```

**注意：** 由于文件较大，实际执行时需要仔细合并导出，可能保持多文件在 `lib/rag/` 目录下。

**决策：** 由于 RAG 服务代码量较大（685 行），保持 `lib/rag/` 目录结构，只移动位置。

**修正方案：**
```bash
mv web/services/rag web/lib/rag
```

**Step 3: 更新所有导入**

```bash
grep -r "from '@/services/rag'" web --include="*.ts" --include="*.tsx"
```

替换 `@/services/rag` 为 `@/lib/rag`

**Step 4: 删除空 services 目录**

```bash
# 检查是否还有其他 services 子目录
ls web/services/
```

**Step 5: 提交**

```bash
git add web/lib web/services
git commit -m "refactor: move services/rag to lib/rag"
```

---

#### Task 10: 合并 services/profile 到 lib/profile.ts

**Files:**
- Move: `web/services/profile/ProfileService.ts` → `web/lib/profile.ts`
- Delete: `web/services/profile/`

**Step 1: 移动文件**

```bash
mv web/services/profile/ProfileService.ts web/lib/profile.ts
```

**Step 2: 删除空目录**

```bash
rm -rf web/services/profile
```

**Step 3: 更新所有导入**

```bash
grep -r "from '@/services/profile'" web --include="*.ts" --include="*.tsx"
```

替换 `@/services/profile` 为 `@/lib/profile`

**Step 4: 删除空的 services 目录**

```bash
rmdir web/services 2>/dev/null || rm -rf web/services
```

**Step 5: 提交**

```bash
git add web/lib web/services
git commit -m "refactor: move services/profile to lib/profile.ts"
```

---

### 阶段 4: 清理 infrastructure 和 services 残余

#### Task 11: 删除空的 infrastructure 目录

**Files:**
- Delete: `web/infrastructure/`

**Step 1: 确认目录为空或已迁移**

```bash
ls -la web/infrastructure/
```

**Step 2: 删除目录**

```bash
rm -rf web/infrastructure
```

**Step 3: 提交**

```bash
git add web/infrastructure
git commit -m "refactor: remove empty infrastructure/ directory"
```

---

### 阶段 5: 更新配置和文档

#### Task 12: 更新 tsconfig.json 路径

**Files:**
- Modify: `web/tsconfig.json`

**Step 1: 更新 paths 配置**

编辑 `web/tsconfig.json`，更新为：
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"],
      "@/components/*": ["./components/*"],
      "@/lib/*": ["./lib/*"],
      "@/config/*": ["./config/*"],
      "@/types": ["./types"],
      "@/db": ["./db"],
      "@/db/*": ["./db/*"]
    }
  }
}
```

**Step 2: 提交**

```bash
git add web/tsconfig.json
git commit -m "refactor: update tsconfig.json paths for flat structure"
```

---

#### Task 13: 更新 README.md

**Files:**
- Modify: `README.md`

**Step 1: 更新项目结构部分**

将 `apps/` 和 `packages/` 相关描述更新为：
```markdown
## Project Structure

nexusnote/
├── web/                          # Next.js Fullstack App
│   ├── app/                      # App Router
│   ├── components/               # UI Components
│   │   ├── ui/                   # Base UI Components
│   │   ├── editor/               # Editor Components
│   │   ├── chat/                 # Chat Components
│   │   ├── auth/                 # Auth Components
│   │   └── shared/               # Shared Components
│   ├── lib/                      # Utilities & Services
│   │   ├── db.ts                 # Database Client
│   │   ├── ai.ts                 # AI Tools
│   │   ├── algorithm.ts          # FSRS Algorithm
│   │   ├── queue.ts              # BullMQ Queue
│   │   ├── rag.ts                # RAG Services
│   │   └── utils.ts              # Helper Functions
│   ├── config/                   # Environment Config
│   ├── types/                    # TypeScript Types
│   └── db/                       # Database Schema
├── deploy/                       # K8s Deployment
└── docs/                        # Documentation
```

**Step 2: 更新快速开始命令

```bash
# 移除 monorepo 相关命令
# 更新为 cd web && pnpm dev
```

**Step 3: 提交**

```bash
git add README.md
git commit -m "docs: update README for flat architecture"
```

---

### 阶段 6: 更新依赖

#### Task 14: 更新过时的依赖

**Files:**
- Modify: `web/package.json`

**Step 1: 检查可更新的包**

```bash
cd web && pnpm outdated
```

**Step 2: 更新以下依赖**

根据输出，安全更新：
- `ai`: 6.0.94 → latest
- `drizzle-orm`: → latest
- `drizzle-kit`: → latest

**Step 3: 安装更新**

```bash
cd web && pnpm install
```

**Step 4: 验证类型检查**

```bash
pnpm typecheck
```

**Step 5: 提交**

```bash
git add web/package.json web/pnpm-lock.yaml
git commit -m "chore: update dependencies to latest stable versions"
```

---

### 阶段 7: 验证

#### Task 15: 全面验证

**Files:** 无

**Step 1: 类型检查**

```bash
cd web && pnpm typecheck
```

Expected: 无错误

**Step 2: Lint 检查**

```bash
npx biome check web/
```

Expected: 无阻塞性错误

**Step 3: 构建测试**

```bash
pnpm build
```

Expected: 构建成功

**Step 4: 最终提交**

```bash
git add .
git commit -m "chore: verify flat architecture refactor complete"
```

---

## 导入路径变更汇总

| 旧路径 | 新路径 | 说明 |
|--------|--------|------|
| `@/lib/ai` | `@/lib/ai` | 保持不变 |
| `@/lib/fsrs` | `@/lib/algorithm` | FSRS 算法 |
| `@/lib/queue` | `@/lib/queue` | 保持不变 |
| `@/lib/ui` | `@/components/ui` | UI 组件 |
| `@/infrastructure/ai/provider` | `@/lib/ai` | AI Provider |
| `@/infrastructure/queue` | `@/lib/queue` | 队列配置 |
| `@/services/rag` | `@/lib/rag` | RAG 服务 |
| `@/services/profile` | `@/lib/profile` | Profile 服务 |
| `@/ui/home/*` | `@/components/shared/home/*` | 首页组件 |
| `@/ui/layout/*` | `@/components/shared/layout/*` | 布局组件 |
| `@/ui/ui/*` | `@/components/ui/*` | 消除嵌套 |
| `@/stores` | `@/components/{auth,editor}` | stores 已内联 |

---

## 删除的目录/文件

- `web/stores/` - 遗留的 re-exports
- `web/ui/ui/` - 奇怪的嵌套结构
- `web/ui/home/` - 移到 components/shared
- `web/ui/layout/` - 移到 components/shared
- `web/lib/ai/` - 合并到 lib/ai.ts
- `web/lib/fsrs/` - 重命名为 lib/algorithm.ts
- `web/lib/ui/` - 移到 components/ui
- `web/lib/queue/` - 合并到 lib/queue.ts
- `web/infrastructure/` - 配置合并到 lib/
- `web/services/` - 移到 lib/

---

## 验证清单

- [ ] `stores/` 目录已删除
- [ ] `ui/ui/` 嵌套已消除
- [ ] `ui/home/` 已移到 `components/shared/home/`
- [ ] `ui/layout/` 已移到 `components/shared/layout/`
- [ ] `lib/ai/` 已合并到 `lib/ai.ts`
- [ ] `lib/fsrs/` 已重命名为 `lib/algorithm.ts`
- [ ] `lib/queue/` 已合并到 `lib/queue.ts`
- [ ] `lib/ui/` 已移到 `components/ui/`
- [ ] `infrastructure/` 已删除
- [ ] `services/` 已移到 `lib/`
- [ ] `tsconfig.json` 路径已更新
- [ ] `README.md` 已更新
- [ ] `pnpm typecheck` 通过
- [ ] `pnpm build` 成功
