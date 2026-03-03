# NexusNote 项目瘦身计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** 删除死代码、未使用模块，简化 AI 系统架构

**原则:** 不兜底，只正确

---

## Phase 1: 数据库清理

### Task 1: 删除 topics 和 extracted_notes 表

**删除：**
- `db/schema.ts` 中的 `topics` 表定义
- `db/schema.ts` 中的 `extractedNotes` 表定义
- 相关 relations 定义
- 相关类型导出

**验证：**
```bash
bun run typecheck
```

**注意：** 生产数据库需要单独迁移删除表，这里只删除代码定义

---

### Task 2: 删除 persona_subscriptions 表

**删除：**
- `db/schema.ts` 中的 `personaSubscriptions` 表定义
- `db/schema.ts` 中的 `personaSubscriptionsRelations`
- `usersRelations` 中的 `personaSubscriptions` 关联

---

## Phase 2: AI 核心清理

### Task 3: 精简 lib/ai/core.ts

**删除：**
- `CircuitBreaker` 类及类型（第 14-99 行）
- `PromptRegistry` 类及类型（第 101-168 行）
- `safeGenerateObject` 函数（第 170-226 行）
- 相关类型导出

**保留：**
- `AIProvider` 类
- `aiProvider` 单例
- `MODELS` 配置

**修复：** 将 `pro` 模型改为正确的 pro 模型
```typescript
const MODELS = {
  chat: "gemini-3-flash-preview",
  pro: "gemini-3-pro-preview",  // 修复
  webSearch: "gemini-3-flash-preview-web-search",
  embedding: "BAAI/bge-base-zh-v1.5",
} as const;
```

---

### Task 4: 删除 lib/emotion/ 目录

**删除整个目录：**
- `lib/emotion/detector.ts`
- `lib/emotion/response-adapter.ts`
- `lib/emotion/index.ts`

**修改 app/api/chat/route.ts：**
- 删除 `import { buildEmotionAdaptationPrompt, detectEmotion } from "@/lib/emotion"`
- 删除 emotion 相关逻辑
- PersonalizationOptions 中删除 emotionAdaptation

**修改 lib/ai/agents/index.ts：**
- PersonalizationOptions 中删除 emotionAdaptation

---

### Task 5: 删除 STYLE Agent

**修改 lib/ai/agents/index.ts：**
- 删除 `INSTRUCTIONS.style`
- 删除 `styleTools`
- 删除 `getAgent` 中 `case "STYLE"` 分支
- getAgent 的 intent 类型中删除 "STYLE"

**删除 lib/ai/tools/style/ 目录**

**修改 components/chat/tool-result/ToolResultRenderer.tsx：**
- 删除 `case "analyzeStyle"` 分支

**修改 app/api/chat/route.ts：**
- 删除 style 相关导入（如果有）

---

## Phase 3: 依赖修复

### Task 6: 修复 lib/skills/ 中的 safeGenerateObject 调用

**文件：**
- `lib/skills/discovery.ts`
- `lib/skills/relationships.ts`

**方案：** 改用 AI SDK 的 `generateObject` 直接调用

```typescript
// 旧代码
import { aiProvider, safeGenerateObject } from "@/lib/ai/core";
const result = await safeGenerateObject({ schema, model, system, prompt });

// 新代码
import { generateObject } from "ai";
import { aiProvider } from "@/lib/ai/core";
const result = await generateObject({ schema, model: aiProvider.proModel, system, prompt });
```

---

### Task 7: 简化 Personalization 流程

**修改 lib/ai/agents/index.ts：**
```typescript
// 简化 PersonalizationOptions
interface PersonalizationOptions {
  personaPrompt?: string;
  userContext?: string;
  // 删除 emotionAdaptation
}
```

**修改 app/api/chat/route.ts：**
- 删除 emotion 检测和 adaptation 逻辑
- 简化 personalization 构建

---

### Task 8: 清理 lib/ai/index.ts 导出

**删除导出：**
- `CircuitBreaker`
- `PromptRegistry`
- `safeGenerateObject`
- `CircuitBreakerConfig` 类型
- `CircuitState` 类型
- `PromptTemplate` 类型

---

## Phase 4: 验证

### Task 9: 类型检查和构建

```bash
bun run typecheck
bun run build
bun run lint
```

---

## 删除清单汇总

| 类别 | 项目 | 文件 |
|------|------|------|
| 表 | `topics` | db/schema.ts |
| 表 | `extracted_notes` | db/schema.ts |
| 表 | `persona_subscriptions` | db/schema.ts |
| 目录 | `lib/emotion/` | 整个目录 |
| 目录 | `lib/ai/tools/style/` | 整个目录 |
| 类 | `CircuitBreaker` | lib/ai/core.ts |
| 类 | `PromptRegistry` | lib/ai/core.ts |
| 函数 | `safeGenerateObject` | lib/ai/core.ts |
| Agent | `STYLE` | lib/ai/agents/index.ts |
| 工具 | `analyzeStyleTool` | lib/ai/tools/style/ |

---

## 修复清单汇总

| 项目 | 问题 | 文件 |
|------|------|------|
| Pro Model | flash → pro | lib/ai/core.ts |
| safeGenerateObject 调用 | 改用 generateObject | lib/skills/*.ts |
| emotion 引用 | 删除调用 | app/api/chat/route.ts |
| STYLE case | 删除分支 | 多个文件 |

---

## 执行顺序

1. Task 1-2: 数据库表删除（低风险）
2. Task 3: 核心清理（高风险，需仔细）
3. Task 4-5: 模块删除
4. Task 6-8: 依赖修复
5. Task 9: 验证
