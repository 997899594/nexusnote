# 代码优化设计文档

**日期**: 2026-02-28
**范围**: 架构设计 + 代码重复
**方案**: 中度重构

---

## 背景

NexusNote 项目经过多轮迭代，存在以下可优化点：

1. API 路由中大量重复的认证和错误处理代码
2. Schema 中 10 个几乎相同的 EMA 字段定义
3. 6 处 `as any` 类型断言绕过类型检查
4. API 响应格式不统一

---

## 设计目标

- **代码复用**: 消除重复的样板代码
- **类型安全**: 移除所有 `as any` 断言
- **一致性**: 统一 API 响应格式
- **可维护性**: 提取公共类型定义

---

## 设计详情

### 1. API 路由抽象

**新增文件**: `lib/api/route-helpers.ts`

```typescript
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { APIError, handleError } from "./errors";

type RouteHandler<T = unknown> = (
  request: NextRequest,
  context: { userId: string }
) => Promise<NextResponse<T>>;

type OptionalAuthHandler<T = unknown> = (
  request: NextRequest,
  context: { userId: string | null }
) => Promise<NextResponse<T>>;

/**
 * 认证路由高阶函数
 * 自动处理认证检查和错误处理
 */
export function withAuth<T>(handler: RouteHandler<T>) {
  return async (request: NextRequest) => {
    try {
      const session = await auth();
      if (!session?.user) {
        throw new APIError("Unauthorized", 401, "UNAUTHORIZED");
      }
      return handler(request, { userId: session.user.id });
    } catch (error) {
      return handleError(error);
    }
  };
}

/**
 * 可选认证路由高阶函数
 * 允许匿名访问，但提供用户信息（如有）
 */
export function withOptionalAuth<T>(handler: OptionalAuthHandler<T>) {
  return async (request: NextRequest) => {
    try {
      const session = await auth();
      return handler(request, {
        userId: session?.user?.id ?? null
      });
    } catch (error) {
      return handleError(error);
    }
  };
}
```

**重构示例**:

```typescript
// 重构前 (28 行)
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      throw new APIError("Unauthorized", 401, "UNAUTHORIZED");
    }
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const options = GraphQuerySchema.parse(searchParams);
    const graphData = await getUserSkillGraphData(session.user.id, options);
    return Response.json(graphData);
  } catch (error) {
    return handleError(error);
  }
}

// 重构后 (8 行)
export const GET = withAuth(async (request, { userId }) => {
  const searchParams = Object.fromEntries(request.nextUrl.searchParams);
  const options = GraphQuerySchema.parse(searchParams);
  const graphData = await getUserSkillGraphData(userId, options);
  return Response.json(graphData);
});
```

**受影响路由** (15 个):

| 路由 | 方法 |
|------|------|
| `/api/skills/graph` | GET |
| `/api/skills/recommend` | GET |
| `/api/skills/discover` | POST |
| `/api/style/analyze` | POST |
| `/api/style/privacy` | GET, PUT, DELETE |
| `/api/user/preferences` | GET |
| `/api/user/persona` | PUT |
| `/api/courses/generate` | POST |
| `/api/chat-sessions/[id]` | GET, DELETE |
| `/api/chat-sessions/index` | POST |

---

### 2. Schema 类型抽象

**新增文件**: `types/profile.ts`

```typescript
/**
 * 指数移动平均值类型
 * 用于风格分析和个性特征的持续追踪
 */
export interface EMAValue {
  /** 当前值 (0-1 范围) */
  value: number;
  /** 置信度 (0-1，随样本增加提高) */
  confidence: number;
  /** 累计样本数 */
  samples: number;
  /** 最后分析时间 (ISO 字符串) */
  lastAnalyzedAt: string;
}

/** 写作风格维度 */
export type StyleDimension =
  | 'vocabularyComplexity'
  | 'sentenceComplexity'
  | 'abstractionLevel'
  | 'directness'
  | 'conciseness'
  | 'formality'
  | 'emotionalIntensity';

/** Big Five 人格维度 */
export type BigFiveDimension =
  | 'openness'
  | 'conscientiousness'
  | 'extraversion'
  | 'agreeableness'
  | 'neuroticism';

/** 所有可追踪维度 */
export type TrackableDimension = StyleDimension | BigFiveDimension;
```

**更新 `db/schema.ts`**:

```typescript
import type { EMAValue } from "@/types/profile";

export const userProfiles = pgTable("user_profiles", {
  // ...

  // 写作风格
  vocabularyComplexity: jsonb("vocabulary_complexity").$type<EMAValue>(),
  sentenceComplexity: jsonb("sentence_complexity").$type<EMAValue>(),
  abstractionLevel: jsonb("abstraction_level").$type<EMAValue>(),
  directness: jsonb("directness").$type<EMAValue>(),
  conciseness: jsonb("conciseness").$type<EMAValue>(),
  formality: jsonb("formality").$type<EMAValue>(),
  emotionalIntensity: jsonb("emotional_intensity").$type<EMAValue>(),

  // Big Five 人格
  openness: jsonb("openness").$type<EMAValue>(),
  conscientiousness: jsonb("conscientiousness").$type<EMAValue>(),
  extraversion: jsonb("extraversion").$type<EMAValue>(),
  agreeableness: jsonb("agreeableness").$type<EMAValue>(),
  neuroticism: jsonb("neuroticism").$type<EMAValue>(),

  // ...
});
```

---

### 3. Embedding 类型修复

**问题**: 6 处使用 `as any` 绕过类型检查

```typescript
// 当前代码
await embed({
  model: aiProvider.embeddingModel as any,
  input: text,
});
```

**解决方案**: 更新 `lib/ai/core.ts` 返回正确类型

```typescript
import type { EmbeddingModelV3 } from "ai";

class AIProvider {
  /** Get the embedding model with correct typing */
  get embeddingModel(): EmbeddingModelV3<string> {
    if (!this.client) {
      throw new Error("AI Provider not initialized");
    }
    return this.client.embedding(MODELS.embedding) as EmbeddingModelV3<string>;
  }
}
```

**受影响文件**:

| 文件 | 位置 |
|------|------|
| `lib/rag/hybrid-search.ts` | 第 51 行 |
| `lib/rag/semantic-chunker.ts` | 第 103 行 |
| `lib/rag/chunker.ts` | 第 91, 156 行 |
| `lib/ai/services/tag-generation-service.ts` | 第 153 行 |
| `lib/tiptap/markdown.ts` | 第 35 行 (单独评估) |

---

### 4. 统一 API 响应工具

**新增文件**: `lib/api/response.ts`

```typescript
import { NextResponse } from "next/server";

/** 成功响应 */
export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

/** 创建响应 (201) */
export function apiCreated<T>(data: T) {
  return NextResponse.json(data, { status: 201 });
}

/** 无内容响应 (204) */
export function apiNoContent() {
  return new NextResponse(null, { status: 204 });
}

/** 分页响应 */
export function apiPaginated<T>(
  items: T[],
  pagination: { page: number; pageSize: number; total: number }
) {
  return NextResponse.json({
    items,
    pagination: {
      ...pagination,
      totalPages: Math.ceil(pagination.total / pagination.pageSize),
    },
  });
}
```

**使用示例**:

```typescript
// GET 请求
return apiSuccess(graphData);

// POST 创建
return apiCreated(newSession);

// DELETE 操作
return apiNoContent();

// 分页列表
return apiPaginated(sessions, { page: 1, pageSize: 20, total: 100 });
```

---

## 文件变更清单

### 新增文件 (3 个)

| 文件 | 用途 |
|------|------|
| `lib/api/route-helpers.ts` | withAuth, withOptionalAuth |
| `types/profile.ts` | EMAValue, StyleDimension, BigFiveDimension |
| `lib/api/response.ts` | apiSuccess, apiCreated, apiNoContent, apiPaginated |

### 修改文件

| 文件 | 变更内容 |
|------|----------|
| `db/schema.ts` | 使用 EMAValue 类型 |
| `lib/ai/core.ts` | 修复 embeddingModel 类型 |
| `lib/rag/hybrid-search.ts` | 移除 as any |
| `lib/rag/semantic-chunker.ts` | 移除 as any |
| `lib/rag/chunker.ts` | 移除 as any |
| `lib/ai/services/tag-generation-service.ts` | 移除 as any |
| `lib/style/analysis.ts` | 使用 EMAValue 类型 |
| `lib/style/ema.ts` | 确保返回值符合类型 |
| `lib/api/index.ts` | 导出新模块 |
| 15 个 API 路由 | 使用 withAuth 重构 |

---

## 预期收益

| 指标 | 改进 |
|------|------|
| API 路由代码量 | 减少 ~40% |
| `as any` 使用 | 6 → 0 |
| 类型复用 | 10 个字段共用 1 个类型 |
| 响应格式 | 统一为 4 种标准函数 |

---

## 风险评估

- **风险等级**: 低
- **向后兼容**: API 响应格式不变
- **测试策略**: 逐路由迁移，每迁移一个验证功能
- **回滚策略**: Git revert 即可

---

## 下一步

1. 创建实现计划 (implementation plan)
2. 按优先级依次实施
3. 每个 PR 包含一个模块的完整重构
