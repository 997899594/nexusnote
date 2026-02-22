# Features to UI Refactor Design

**Date:** 2025-02-22
**Status:** Draft
**Author:** Claude + User

## Overview

将 `features/` 目录重命名为 `ui/`，并清理与 `services/` 和 `infrastructure/` 层的重复代码。

## Current State

```
apps/web/
├── features/           # 当前 UI 层
│   ├── ai/
│   │   ├── rag/        # 与 services/rag/ 重复 ❌
│   │   ├── provider.ts # 与 infrastructure/ai/provider 重复 ❌
│   │   ├── agents/     # AI agents
│   │   ├── tools/      # AI 工具
│   │   ├── types/      # AI 类型
│   │   ├── validation/ # AI 验证
│   │   ├── lib/        # AI 工具库
│   │   └── circuit-breaker.ts
│   ├── chat/
│   ├── editor/
│   ├── home/
│   ├── layout/
│   └── ui/             # 通用 UI 组件
│
├── services/           # 业务逻辑层（新增）
│   ├── profile/
│   └── rag/
│
├── infrastructure/     # 基础设施层（新增）
│   └── ai/
```

## Target Structure

```
apps/web/
├── ui/                 # 重命名自 features/
│   ├── ai/             # 保留：agents, tools, types, validation, lib
│   ├── chat/           # 聊天 UI 组件
│   ├── editor/         # 编辑器 UI 组件
│   ├── home/           # 首页 UI 组件
│   ├── layout/         # 布局组件
│   └── ui/             # 通用 UI 组件（或合并）
│
├── services/           # 业务逻辑层
│   ├── profile/        # 用户画像服务
│   └── rag/             # RAG 服务（包含 semantic-chunker）
│
├── infrastructure/     # 基础设施层
│   └── ai/             # AI provider 配置
│
├── lib/                # 工具函数
├── stores/             # 状态管理
├── types/              # 全局类型
└── app/                # Next.js 路由
```

## Changes

### 1. Rename `features/` → `ui/`

- 整个目录重命名
- 更新所有导入路径 `@/features/*` → `@/ui/*`

### 2. Clean up duplicates

| 源路径 | 操作 | 原因 |
|--------|------|------|
| `features/ai/rag/` | 删除 | 与 `services/rag/` 重复 |
| `features/ai/provider.ts` | 删除 | 与 `infrastructure/ai/provider` 重复 |

### 3. Migrate valuable code

| 源路径 | 目标路径 | 说明 |
|--------|----------|------|
| `features/ai/rag/semantic-chunker.ts` | `services/rag/semantic-chunker.ts` | 语义分块功能 |
| `features/ai/rag/utils/cosine-similarity.ts` | `services/rag/utils/cosine-similarity.ts` | 余弦相似度工具 |

### 4. Keep in ui/ai/

| 目录/文件 | 保留原因 |
|----------|----------|
| `agents/` | AI agents（UI 层逻辑） |
| `tools/` | AI 工具（UI 层调用） |
| `types/` | AI 相关类型 |
| `validation/` | AI 验证逻辑 |
| `lib/` | AI 工具库 |
| `circuit-breaker.ts` | 熔断器 |

## Import Path Updates

所有文件中需要更新：

```typescript
// AI RAG 功能
- import { xxx } from "@/features/ai/rag"
+ import { xxx } from "@/services/rag"

// AI provider
- import { aiProvider } from "@/features/ai/provider"
+ import { aiProvider } from "@/infrastructure/ai/provider"

// 其他 features（重命名后）
- import { xxx } from "@/features/xxx"
+ import { xxx } from "@/ui/xxx"
```

## Implementation Notes

1. **Flexible approach**: 如果在重构过程中发现更好的实现方式，可以调整
2. **Semantic-chunker**: 是有价值的代码，需要迁移到 services/rag/
3. **agents/** 和 tools/**: 保留在 ui/ai/，因为它们与 UI 层交互紧密
4. **tsconfig paths**: 更新 `@/features/*` → `@/ui/*`

## Success Criteria

- [ ] `features/` 重命名为 `ui/`
- [ ] 删除重复的 rag/ 和 provider.ts
- [ ] semantic-chunker 迁移到 services/rag/
- [ ] 所有导入路径更新
- [ ] 类型检查通过
- [ ] 现有功能无回归
