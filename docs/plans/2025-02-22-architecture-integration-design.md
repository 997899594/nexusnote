# Architecture Integration Design

**Date**: 2025-02-22
**Status**: Draft
**Author**: Claude + User

## Overview

整合 `feat/arch-redesign` 分支的架构改进（services/infrastructure 分层）到 main 分支，同时保留 main 中更优的实现（knowledgeChunks 统一表、完整的 RAG 功能）。

## Background

### 分支对比分析

| 维度 | main (当前) | feat/arch-redesign | 决策 |
|------|-----------|-------------------|------|
| **知识表** | `knowledgeChunks` (统一表) | `documentChunks` (旧表) | **保留 main** |
| **架构分层** | 无 services/ 层 | services/ + infrastructure/ | **采用 arch-redesign** |
| **userProfiles** | 无 | 有（用户学习画像） | **采用 arch-redesign** |
| **RAG 功能** | 完整（含 semantic-chunker） | 简化版 | **保留 main** |
| **chat 组件** | 完整 | 简化版 | **保留 main** |

### refactor/architecture-v2 状态

- 已经落后 main 5 个提交
- 其 K8s 部署改进已在 main 中
- **不需要合并**

## Design

### 1. 目标架构

```
apps/web/
├── services/                        # 业务逻辑层（新增）
│   ├── index.ts
│   ├── rag/                         # RAG 服务（适配 knowledgeChunks）
│   │   ├── index.ts
│   │   ├── chunker.ts              # 从 features/ai/rag 适配
│   │   ├── hybrid-search.ts        # 从 features/ai/rag 适配
│   │   └── query-rewriter.ts       # 从 features/ai/rag 适配
│   ├── profile/                     # 用户画像服务（新增）
│   │   ├── index.ts
│   │   ├── ProfileService.ts
│   │   └── ProfileUpdater.ts
│   └── course/                      # 课程编排服务（新增）
│       ├── index.ts
│       └── CourseOrchestrator.ts
├── infrastructure/                  # 基础设施层（新增）
│   ├── index.ts
│   ├── ai/
│   │   └── provider.ts             # AI provider 集中配置
│   └── queue/
│       └── index.ts                # 队列配置
├── features/                        # UI 相关功能层（保留）
│   ├── ai/rag/                     # 保留现有实现
│   ├── chat/                       # 保留现有实现
│   └── ...
└── app/api/                         # API 路由（保留）
```

### 2. Schema 变更

#### 新增：userProfiles 表

```sql
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,

  -- 学习目标和风格
  learning_goals JSONB,
  knowledge_areas JSONB,
  learning_style JSONB,

  -- 学习历史和评估
  assessment_history JSONB,

  -- 当前水平
  current_level TEXT,
  total_study_minutes INTEGER DEFAULT 0,

  -- 画像向量（用于个性化 RAG）
  profile_embedding halfvec(4000),

  updated_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX user_profiles_user_id_idx ON user_profiles(user_id);
CREATE INDEX user_profiles_embedding_hnsw_idx ON user_profiles USING hnsw (profile_embedding halfvec_cosine_ops);
```

#### 修改：courseProfiles

```sql
-- 新增字段
ALTER TABLE course_profiles ADD COLUMN status TEXT DEFAULT 'idle';
ALTER TABLE course_profiles ADD COLUMN current_step JSONB;

-- 保留旧字段以兼容
-- interview_status 字段保留但弃用
```

#### 保留：knowledgeChunks 表（不做修改）

```sql
-- main 已有实现，不需要修改
CREATE TABLE knowledge_chunks (
  id UUID PRIMARY KEY,
  source_type TEXT NOT NULL,
  source_id UUID NOT NULL,
  content TEXT NOT NULL,
  embedding halfvec(4000),
  chunk_index INTEGER NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 3. 服务层设计

#### services/rag/

从 `features/ai/rag/` 适配而来，主要变更：
- 使用 `knowledgeChunks` 而非 `documentChunks`
- 导出简洁的 API 供外部调用

```typescript
// services/rag/index.ts
export {
  chunkText,
  indexDocument,
  reindexAllDocuments,
} from "./chunker";

export {
  hybridSearch,
  type HybridSearchResult,
} from "./hybrid-search";

export {
  rewriteQuery,
} from "./query-rewriter";
```

#### services/profile/

用户画像管理服务：

```typescript
// services/profile/index.ts
export {
  getOrCreate,
  update,
  getProfileChunk,
  updateProfileEmbedding,
  deleteProfile,
} from "./ProfileService";

export {
  updateFromCourseCompletion,
  updateFromAssessment,
  updateFromStudySession,
} from "./ProfileUpdater";
```

#### infrastructure/ai/

AI provider 集中配置：

```typescript
// infrastructure/ai/provider.ts
class AIProvider {
  isConfigured(): boolean;
  get chatModel(): LanguageModelV3;
  get embeddingModel(): EmbeddingModel;
}

export const aiProvider = new AIProvider();
```

### 4. 依赖关系

```
app/api/          →  services/      →  infrastructure/
                      ↓
                   features/       (UI 组件直接调用 services 或 infrastructure)
```

**规则**：
- services/ 可以依赖 infrastructure/
- features/ 可以依赖 services/ 和 infrastructure/
- infrastructure/ 不依赖任何上层代码

### 5. 迁移步骤

#### Phase 1: 基础设施层（低风险）

1. 创建 `infrastructure/` 目录
2. 迁移 AI provider 配置
3. 迁移队列配置
4. 更新所有引用

#### Phase 2: 数据层（低风险）

1. 生成 userProfiles 表迁移
2. 生成 courseProfiles 字段迁移
3. 运行迁移

#### Phase 3: 服务层（中风险）

1. 创建 `services/` 目录结构
2. 适配 RAG 服务（使用 knowledgeChunks）
3. 实现 Profile 服务
4. 更新 API 路由以使用 services

#### Phase 4: 验证（必需）

1. 单元测试
2. 集成测试
3. 手动测试

### 6. 兼容性保证

| 组件 | 兼容性策略 |
|------|-----------|
| `features/ai/rag/` | 保留现有导出，内部可调用 services/rag/ |
| `features/chat/` | 无变化 |
| API 路由 | 逐步迁移到 services/，保持响应格式不变 |
| 前端组件 | 无变化（通过 API 交互） |

## Implementation Plan

详见 `docs/plans/2025-02-22-architecture-integration-implementation.md`（待创建）

## Risks & Mitigations

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| 破坏现有 RAG 功能 | 低 | 高 | 保留 features/ai/rag/，逐步迁移 |
| 数据迁移失败 | 中 | 高 | 先在测试环境验证，准备回滚脚本 |
| services/ 层过度设计 | 中 | 中 | YAGNI 原则，只迁移必要的代码 |

## Success Criteria

- [ ] userProfiles 表创建成功
- [ ] services/ 和 infrastructure/ 目录创建
- [ ] 现有功能无回归（RAG、chat、course）
- [ ] Profile 服务可用
- [ ] 所有测试通过

## Open Questions

1. ~~是否需要立即实现 CourseOrchestrator？~~ → 暂不实现（YAGNI）
2. services/ 层是否需要添加测试？→ 后续补充
3. ~~semantic-chunker 是否保留？~~ → 保留 main 中的实现

## Implementation Steps

### Step 1: 创建 infrastructure/ 层

**目标**：集中管理外部依赖（AI provider, queue）

```bash
mkdir -p apps/web/infrastructure/ai
mkdir -p apps/web/infrastructure/queue
```

**文件清单**：
- `apps/web/infrastructure/index.ts` - 导出入口
- `apps/web/infrastructure/ai/provider.ts` - AI provider（从 arch-redesign 复制）
- `apps/web/infrastructure/queue/index.ts` - 队列配置

**适配点**：
- AI provider 需要适配 main 的配置方式
- 检查 main 中是否已有类似实现，避免重复

### Step 2: 创建 services/ 层

**目标**：业务逻辑层，为 API 和 features 提供服务

```bash
mkdir -p apps/web/services/rag
mkdir -p apps/web/services/profile
```

**文件清单**：
- `apps/web/services/index.ts` - 导出入口
- `apps/web/services/rag/index.ts` - RAG 服务（适配 main 的 features/ai/rag）
- `apps/web/services/rag/chunker.ts` - 从 features/ai/rag 适配
- `apps/web/services/rag/hybrid-search.ts` - 从 features/ai/rag 适配
- `apps/web/services/profile/index.ts` - 画像服务
- `apps/web/services/profile/ProfileService.ts` - 从 arch-redesign 复制
- `apps/web/services/profile/ProfileUpdater.ts` - 从 arch-redesign 复制

**适配点**：
- services/rag 需要使用 main 的 `knowledgeChunks` 表
- 保留 main 中的 `semantic-chunker` 功能

### Step 3: 数据库变更

**新增 userProfiles 表**：

```sql
-- 生成迁移
pnpm db:generate

-- 手动添加向量索引（在生成的 SQL 中）
CREATE INDEX user_profiles_embedding_hnsw_idx
ON user_profiles USING hnsw (profile_embedding halfvec_cosine_ops);
```

**修改 courseProfiles 表**：

```sql
ALTER TABLE course_profiles ADD COLUMN status TEXT DEFAULT 'idle';
ALTER TABLE course_profiles ADD COLUMN current_step JSONB;
```

### Step 4: 更新 API 路由

**渐进式迁移**：
- 暂不修改现有 API
- 新功能使用 services 层
- 逐步重构旧 API

### Step 5: 验证

1. 运行迁移：`pnpm db:migrate`
2. 检查类型：`pnpm typecheck`
3. 运行测试：`pnpm test`
4. 手动测试核心功能

## 分支策略

```bash
# 创建新分支进行移植
git checkout -b feat/services-infrastructure-layers

# 执行移植...

# 提交
git commit -m "feat: add services and infrastructure layers

- Add infrastructure/ai/provider for centralized AI configuration
- Add services/profile for user learning profile management
- Add services/rag adapted from features/ai/rag
- Add userProfiles table with profileEmbedding
- Update courseProfiles with status and currentStep fields"
```
