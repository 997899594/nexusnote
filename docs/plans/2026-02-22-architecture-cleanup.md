# NexusNote 架构清理与统一实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**目标：** 清理项目架构中的重复代码、遗留文件和混乱的分层结构，确保架构统一清晰。

**架构：** 采用清晰的分层架构 - `ui/` (页面组件), `services/` (业务逻辑), `lib/` (纯函数工具), `infrastructure/` (外部依赖配置), `config/` (环境配置)。

**技术栈：** Next.js 16, TypeScript, Zustand, Drizzle ORM

---

## 发现的问题

| 问题 | 位置 | 解决方案 |
|------|------|----------|
| 重复的 `cn` 函数 | `lib/utils.ts` + `lib/ui/utils.ts` | 删除 `lib/utils.ts` |
| 奇怪的 `ui/ui/` 嵌套 | `ui/ui/components/Toast.tsx` | 移到 `ui/components/Toast.tsx` |
| 遗留的 `stores/` 目录 | `stores/index.ts` (已废弃) | 删除整个目录 |
| README 过时 | 根目录 README.md | 更新为单项目结构 |
| 依赖版本 | 多个包有更新可用 | 更新到最新稳定版 |

---

## 最终目标结构

```
web/
├── app/                    # Next.js App Router
├── config/                 # 环境配置
│   └── env.ts
├── db/                     # 数据库
│   ├── schema.ts
│   ├── index.ts
│   └── drizzle.config.ts
├── infrastructure/         # 外部依赖配置
│   ├── ai/                # AI Provider 配置
│   └── queue/             # 队列配置
├── lib/                    # 纯函数工具（无业务逻辑）
│   ├── ai/                # AI 工具函数 (circuit-breaker, prompt-registry)
│   ├── fsrs/              # FSRS 算法
│   └── ui/                # UI 基础工具
│       ├── components/    # 基础 UI 组件
│       └── utils.ts       # cn 工具函数
├── services/               # 业务服务层
│   ├── profile/
│   └── rag/
├── types/                  # 类型定义
├── ui/                     # 页面 UI 组件
│   ├── ai/                # AI 相关组件 + stores
│   ├── auth/              # 认证组件 + stores
│   ├── chat/              # 聊天组件 + stores
│   ├── editor/            # 编辑器组件 + stores
│   ├── home/              # 首页组件
│   ├── layout/            # 布局组件
│   └── components/        # 通用页面组件
├── party/                  # PartyKit 协作
└── package.json
```

---

## 实施步骤

### 阶段 1: 清理重复和遗留文件

#### Task 1: 删除重复的 lib/utils.ts

**Files:**
- Delete: `web/lib/utils.ts`

**Step 1: 验证没有文件引用 `@/lib/utils`**

```bash
grep -r "from '@/lib/utils'" web --include="*.ts" --include="*.tsx"
```

Expected: 无结果（已验证过）

**Step 2: 删除文件**

```bash
rm web/lib/utils.ts
```

**Step 3: 验证删除**

```bash
ls web/lib/utils.ts 2>&1
```

Expected: "No such file or directory"

**Step 4: 提交**

```bash
git add web/lib/utils.ts
git commit -m "refactor: remove duplicate lib/utils.ts (use lib/ui/utils.ts)"
```

---

#### Task 2: 移动 ui/ui/components/Toast.tsx

**Files:**
- Move: `web/ui/ui/components/Toast.tsx` → `web/ui/components/Toast.tsx`
- Modify: `web/ui/ui/index.ts`
- Delete: `web/ui/ui/` directory

**Step 1: 创建 ui/components 目录并移动文件**

```bash
mkdir -p web/ui/components
mv web/ui/ui/components/Toast.tsx web/ui/components/
```

**Step 2: 更新 ui/ui/index.ts 为新的导出**

编辑 `web/ui/ui/index.ts`:

```typescript
// Re-export Toast from new location
export { Toast } from "../components/Toast";
```

或者如果这是 ui/ui 唯一的内容，删除整个文件。

**Step 3: 查找并更新所有 Toast 导入**

```bash
grep -r "Toast" web/ui --include="*.tsx" --include="*.ts"
```

如有引用，更新导入路径。

**Step 4: 删除 ui/ui 目录**

```bash
rm -rf web/ui/ui
```

**Step 5: 提交**

```bash
git add web/ui
git commit -m "refactor: move Toast component to ui/components/, remove ui/ui nesting"
```

---

#### Task 3: 删除遗留的 stores 目录

**Files:**
- Delete: `web/stores/`

**Step 1: 查找所有引用 @/stores 的文件**

```bash
grep -r "from '@/stores'" web --include="*.ts" --include="*.tsx"
```

**Step 2: 如有引用，更新为新的路径**

根据查找结果，将:
- `@/stores` → `@/ui/auth` (对于 useAuthStore)
- `@/stores` → `@/ui/editor` (对于 useEditorStore)

**Step 3: 删除 stores 目录**

```bash
rm -rf web/stores
```

**Step 4: 提交**

```bash
git add web/stores
git commit -m "refactor: remove deprecated stores/ directory"
```

---

### 阶段 2: 更新文档

#### Task 4: 更新 README.md

**Files:**
- Modify: `README.md`

**Step 1: 更新项目结构部分**

将以下内容:

```markdown
## Project Structure

nexusnote/
├── apps/
│   └── web/                          # Next.js Fullstack App
├── packages/
│   ├── db/
│   ├── config/
│   ├── types/
│   └── ui/
```

替换为:

```markdown
## Project Structure

nexusnote/
├── web/                              # Next.js Fullstack App
│   ├── app/                          # App Router
│   ├── config/                       # Environment config
│   ├── db/                           # Database schema & client
│   ├── infrastructure/               # External dependencies
│   ├── lib/                          # Pure utilities
│   ├── services/                     # Business logic
│   ├── types/                        # TypeScript types
│   └── ui/                           # UI components
├── deploy/                           # K8s deployment
├── docs/                             # Documentation
└── README.md
```

**Step 2: 更新技术栈描述

移除 "Monorepo" 相关描述，更新为:

```markdown
| **Build** | pnpm | Package manager |
```

**Step 3: 更新快速开始命令

```bash
# 旧命令
pnpm --filter @nexusnote/web dev

# 新命令
pnpm dev
```

**Step 4: 提交**

```bash
git add README.md
git commit -m "docs: update README for single project structure"
```

---

### 阶段 3: 更新依赖

#### Task 5: 更新过时的依赖包

**Files:**
- Modify: `web/package.json`

**Step 1: 检查当前可更新的包**

```bash
cd web && pnpm outdated
```

**Step 2: 更新以下依赖到最新稳定版**

根据 pnpm outdated 结果，更新:
- `ai`: 6.0.94 → 6.0.97 (latest)
- `drizzle-orm`: 0.44.7 → 0.45.1 (latest)
- `drizzle-kit`: 0.30.6 → 0.31.9 (latest)
- `@types/node`: 22.19.11 → 25.3.0 (latest)

**Step 3: 谨慎更新 major 版本**

暂不更新:
- `lucide-react`: 0.475.0 → 0.575.0 (可能 breaking)

**Step 4: 安装更新**

```bash
cd web && pnpm install
```

**Step 5: 验证类型检查**

```bash
pnpm typecheck
```

**Step 6: 提交**

```bash
git add web/package.json web/pnpm-lock.yaml
git commit -m "chore: update dependencies (ai, drizzle-orm, drizzle-kit, @types/node)"
```

---

### 阶段 4: 统一 lib 和 infrastructure 职责

#### Task 6: 统一 AI 相关代码位置

**当前状态:**
- `infrastructure/ai/` - AI Provider 配置
- `lib/ai/` - AI 工具函数 (circuit-breaker, prompt-registry, safe-generate)
- `ui/ai/` - AI UI 组件、agents、tools

**决策: 保持当前分离，但添加清晰的 index.ts 导出**

**Files:**
- Modify: `web/lib/ai/index.ts`
- Modify: `web/infrastructure/ai/index.ts`

**Step 1: 更新 lib/ai/index.ts 添加说明注释**

```typescript
/**
 * @/lib/ai - AI 工具函数
 *
 * 纯函数工具，无副作用：
 * - CircuitBreaker: 三态熔断器
 * - PromptRegistry: Prompt 模板管理
 * - safeGenerateObject: 带重试的结构化输出
 *
 * 依赖: Vercel AI SDK, Zod
 */

export { CircuitBreaker, type CircuitBreakerConfig, type CircuitState } from "./circuit-breaker.js";
export { PromptRegistry, type PromptTemplate } from "./prompt-registry.js";
export { type SafeGenerateOptions, safeGenerateObject } from "./safe-generate.js";
```

**Step 2: 更新 infrastructure/ai/index.ts 添加说明注释**

```typescript
/**
 * @/infrastructure/ai - AI 基础设施配置
 *
 * 外部依赖的配置和管理：
 * - aiProvider: 统一的 AI Provider 实例
 * - 模型选择逻辑
 * - API 密钥管理
 *
 * 依赖: 环境变量, @ai-sdk/openai, @ai-sdk/google
 */

export { aiProvider } from "./provider.js";
```

**Step 3: 提交**

```bash
git add web/lib/ai/index.ts web/infrastructure/ai/index.ts
git commit -m "docs: add clarifying comments to ai modules"
```

---

#### Task 7: 统一 Queue 相关代码位置

**当前状态:**
- `infrastructure/queue/` - 队列配置
- `lib/queue/` - BullMQ 队列实现

**决策: 将队列实现移到 services/queue/**

**Files:**
- Move: `web/lib/queue/` → `web/services/queue/`
- Modify: 更新所有导入

**Step 1: 移动队列目录**

```bash
mv web/lib/queue web/services/queue
```

**Step 2: 更新所有导入**

```bash
# 查找所有引用
grep -r "from '@/lib/queue'" web --include="*.ts" --include="*.tsx"
```

将 `@/lib/queue` 替换为 `@/services/queue`

**Step 3: 提交**

```bash
git add web/lib/queue web/services/queue
git commit -m "refactor: move queue implementation from lib/ to services/"
```

---

### 阶段 5: 验证

#### Task 8: 全面验证

**Files:** 无（验证任务）

**Step 1: 类型检查**

```bash
cd web && pnpm typecheck
```

Expected: 无错误

**Step 2: Lint 检查**

```bash
cd web && npx biome check .
```

Expected: 无阻塞性错误（warn 可接受）

**Step 3: 构建测试**

```bash
cd web && pnpm build
```

Expected: 构建成功

**Step 4: 开发服务器启动**

```bash
cd web && pnpm dev &
# 等待启动
sleep 5
curl http://localhost:3000
```

Expected: 服务器正常启动

**Step 5: 最终提交**

```bash
git add .
git commit -m "chore: verify architecture cleanup complete"
```

---

## 验证清单

完成所有任务后确认:

- [ ] `lib/utils.ts` 已删除
- [ ] `ui/ui/` 目录已删除，Toast 已移到 `ui/components/`
- [ ] `stores/` 目录已删除
- [ ] README.md 已更新为单项目结构
- [ ] 依赖已更新到最新稳定版本
- [ ] `lib/queue/` 已移到 `services/queue/`
- [ ] 所有模块有清晰的注释说明职责
- [ ] `pnpm typecheck` 通过
- [ ] `pnpm build` 成功
- [ ] 开发服务器正常启动

---

## 导入路径变更总结

| 旧路径 | 新路径 | 原因 |
|--------|--------|------|
| `@/lib/utils` | `@/lib/ui/utils` | 消除重复 |
| `@/stores` | `@/ui/auth`, `@/ui/editor` | 删除遗留目录 |
| `@/lib/queue` | `@/services/queue` | 队列是业务服务，不是纯工具 |
| `@/ui/ui/components/Toast` | `@/ui/components/Toast` | 消除嵌套 |
