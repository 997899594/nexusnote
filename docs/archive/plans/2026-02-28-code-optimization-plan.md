# Code Optimization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 消除代码重复、提升类型安全、统一 API 响应格式

**Architecture:** 通过高阶函数抽象 API 路由认证，提取公共类型定义，修复类型断言问题

**Tech Stack:** Next.js App Router, TypeScript, Drizzle ORM, Zod

---

## Task 1: 创建 EMAValue 类型定义

**Files:**
- Create: `types/profile.ts`

**Step 1: 创建类型文件**

```typescript
/**
 * 用户画像相关类型定义
 */

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

**Step 2: 验证类型检查通过**

Run: `bun run typecheck`
Expected: 无新错误

**Step 3: 提交**

```bash
git add types/profile.ts
git commit -m "types: add EMAValue and profile dimension types"
```

---

## Task 2: 更新 Schema 使用 EMAValue 类型

**Files:**
- Modify: `db/schema.ts`

**Step 1: 添加类型导入**

在文件顶部添加：

```typescript
import type { EMAValue } from "@/types/profile";
```

**Step 2: 更新 userProfiles 表的字段类型**

将以下字段从内联类型改为使用 `EMAValue`：

```typescript
// 写作风格 - 替换原有定义
vocabularyComplexity: jsonb("vocabulary_complexity").$type<EMAValue>(),
sentenceComplexity: jsonb("sentence_complexity").$type<EMAValue>(),
abstractionLevel: jsonb("abstraction_level").$type<EMAValue>(),
directness: jsonb("directness").$type<EMAValue>(),
conciseness: jsonb("conciseness").$type<EMAValue>(),
formality: jsonb("formality").$type<EMAValue>(),
emotionalIntensity: jsonb("emotional_intensity").$type<EMAValue>(),

// Big Five 人格 - 替换原有定义
openness: jsonb("openness").$type<EMAValue>(),
conscientiousness: jsonb("conscientiousness").$type<EMAValue>(),
extraversion: jsonb("extraversion").$type<EMAValue>(),
agreeableness: jsonb("agreeableness").$type<EMAValue>(),
neuroticism: jsonb("neuroticism").$type<EMAValue>(),
```

**Step 3: 验证类型检查通过**

Run: `bun run typecheck`
Expected: 无新错误

**Step 4: 提交**

```bash
git add db/schema.ts
git commit -m "refactor(schema): use EMAValue type for profile fields"
```

---

## Task 3: 创建 API 路由辅助函数

**Files:**
- Create: `lib/api/route-helpers.ts`

**Step 1: 创建路由辅助函数文件**

```typescript
/**
 * API 路由辅助函数
 * 提供认证和错误处理的高阶函数封装
 */

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
 *
 * @example
 * export const GET = withAuth(async (request, { userId }) => {
 *   const data = await getData(userId);
 *   return Response.json(data);
 * });
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
        userId: session?.user?.id ?? null,
      });
    } catch (error) {
      return handleError(error);
    }
  };
}
```

**Step 2: 更新 lib/api/index.ts 导出**

```typescript
export * from "./errors";
export * from "./route-helpers";
```

**Step 3: 验证类型检查通过**

Run: `bun run typecheck`
Expected: 无新错误

**Step 4: 提交**

```bash
git add lib/api/route-helpers.ts lib/api/index.ts
git commit -m "feat(api): add withAuth and withOptionalAuth route helpers"
```

---

## Task 4: 创建统一 API 响应工具

**Files:**
- Create: `lib/api/response.ts`
- Modify: `lib/api/index.ts`

**Step 1: 创建响应工具文件**

```typescript
/**
 * 统一 API 响应工具函数
 */

import { NextResponse } from "next/server";

/**
 * 成功响应
 * @param data - 响应数据
 * @param status - HTTP 状态码，默认 200
 */
export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

/**
 * 创建资源成功响应 (201)
 */
export function apiCreated<T>(data: T) {
  return NextResponse.json(data, { status: 201 });
}

/**
 * 无内容响应 (204)
 * 用于 DELETE 操作成功后
 */
export function apiNoContent() {
  return new NextResponse(null, { status: 204 });
}

/**
 * 分页响应
 */
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

**Step 2: 更新 lib/api/index.ts 导出**

```typescript
export * from "./errors";
export * from "./response";
export * from "./route-helpers";
```

**Step 3: 验证类型检查通过**

Run: `bun run typecheck`
Expected: 无新错误

**Step 4: 提交**

```bash
git add lib/api/response.ts lib/api/index.ts
git commit -m "feat(api): add unified response utilities (apiSuccess, apiCreated, apiNoContent)"
```

---

## Task 5: 修复 Embedding 类型

**Files:**
- Modify: `lib/ai/core.ts`

**Step 1: 更新 embeddingModel 返回类型**

在 `AIProvider` 类中，找到 `embeddingModel` getter，更新为：

```typescript
import type { EmbeddingModelV3 } from "ai";

// ... 在 AIProvider 类中

/** Get the embedding model with correct typing */
get embeddingModel(): EmbeddingModelV3<string> {
  if (!this.client) {
    throw new Error("AI Provider not initialized");
  }
  // 使用类型断言确保与 AI SDK 兼容
  return this.client.embedding(MODELS.embedding) as EmbeddingModelV3<string>;
}
```

**Step 2: 验证类型检查通过**

Run: `bun run typecheck`
Expected: 无新错误

**Step 3: 提交**

```bash
git add lib/ai/core.ts
git commit -m "fix(ai): add proper typing for embeddingModel"
```

---

## Task 6: 移除 RAG 模块中的 as any

**Files:**
- Modify: `lib/rag/hybrid-search.ts`
- Modify: `lib/rag/semantic-chunker.ts`
- Modify: `lib/rag/chunker.ts`

**Step 1: 更新 lib/rag/hybrid-search.ts**

找到 `embed` 调用，移除 `as any`：

```typescript
// 修改前
model: aiProvider.embeddingModel as any,

// 修改后
model: aiProvider.embeddingModel,
```

**Step 2: 更新 lib/rag/semantic-chunker.ts**

同样移除 `as any`：

```typescript
// 修改前
model: aiProvider.embeddingModel as any,

// 修改后
model: aiProvider.embeddingModel,
```

**Step 3: 更新 lib/rag/chunker.ts**

有两处需要修改，同样移除 `as any`：

```typescript
// 修改前
model: aiProvider.embeddingModel as any,

// 修改后
model: aiProvider.embeddingModel,
```

**Step 4: 验证类型检查通过**

Run: `bun run typecheck`
Expected: 无新错误

**Step 5: 提交**

```bash
git add lib/rag/hybrid-search.ts lib/rag/semantic-chunker.ts lib/rag/chunker.ts
git commit -m "refactor(rag): remove 'as any' from embedding model usage"
```

---

## Task 7: 移除 tag-generation-service 中的 as any

**Files:**
- Modify: `lib/ai/services/tag-generation-service.ts`

**Step 1: 移除类型断言**

找到 `embed` 调用，移除 `as any`：

```typescript
// 修改前
model: aiProvider.embeddingModel as any,

// 修改后
model: aiProvider.embeddingModel,
```

**Step 2: 验证类型检查通过**

Run: `bun run typecheck`
Expected: 无新错误

**Step 3: 提交**

```bash
git add lib/ai/services/tag-generation-service.ts
git commit -m "refactor(ai): remove 'as any' from tag generation service"
```

---

## Task 8: 重构 /api/skills/graph 路由

**Files:**
- Modify: `app/api/skills/graph/route.ts`

**Step 1: 重构为使用 withAuth**

```typescript
/**
 * GET /api/skills/graph - 获取用户技能图数据
 */

import type { NextRequest } from "next/server";
import { withAuth } from "@/lib/api";
import { getUserSkillGraphData } from "@/lib/skills";
import { GraphQuerySchema } from "@/lib/skills/validation";

export const GET = withAuth(async (request, { userId }) => {
  const searchParams = Object.fromEntries(request.nextUrl.searchParams);
  const options = GraphQuerySchema.parse(searchParams);
  const graphData = await getUserSkillGraphData(userId, options);
  return Response.json(graphData);
});
```

**Step 2: 验证功能正常**

Run: `bun run typecheck`
Expected: 通过

**Step 3: 提交**

```bash
git add app/api/skills/graph/route.ts
git commit -m "refactor(api): use withAuth in skills/graph route"
```

---

## Task 9: 重构 /api/skills/recommend 路由

**Files:**
- Modify: `app/api/skills/recommend/route.ts`

**Step 1: 重构为使用 withAuth**

```typescript
/**
 * GET /api/skills/recommend - 获取推荐技能
 */

import type { NextRequest } from "next/server";
import { withAuth } from "@/lib/api";
import { getRecommendedSkills } from "@/lib/skills";
import { RecommendQuerySchema } from "@/lib/skills/validation";

export const GET = withAuth(async (request, { userId }) => {
  const searchParams = Object.fromEntries(request.nextUrl.searchParams);
  const options = RecommendQuerySchema.parse(searchParams);
  const skills = await getRecommendedSkills(userId, options);
  return Response.json(skills);
});
```

**Step 2: 验证类型检查通过**

Run: `bun run typecheck`
Expected: 通过

**Step 3: 提交**

```bash
git add app/api/skills/recommend/route.ts
git commit -m "refactor(api): use withAuth in skills/recommend route"
```

---

## Task 10: 重构 /api/skills/discover 路由

**Files:**
- Modify: `app/api/skills/discover/route.ts`

**Step 1: 重构为使用 withAuth**

```typescript
/**
 * POST /api/skills/discover - 从内容中发现技能
 */

import type { NextRequest } from "next/server";
import { withAuth } from "@/lib/api";
import { getAgent } from "@/lib/ai";
import { DiscoverSkillsSchema } from "@/lib/skills/validation";

export const POST = withAuth(async (request, { userId }) => {
  const body = await request.json();
  const { content } = DiscoverSkillsSchema.parse(body);

  const agent = getAgent("skill-discovery");
  // ... 业务逻辑

  return Response.json({ success: true });
});
```

**Step 2: 验证类型检查通过**

Run: `bun run typecheck`
Expected: 通过

**Step 3: 提交**

```bash
git add app/api/skills/discover/route.ts
git commit -m "refactor(api): use withAuth in skills/discover route"
```

---

## Task 11: 重构 /api/style 路由组

**Files:**
- Modify: `app/api/style/analyze/route.ts`
- Modify: `app/api/style/privacy/route.ts`

**Step 1: 重构 style/analyze**

```typescript
/**
 * POST /api/style/analyze - 分析用户写作风格
 */

import type { NextRequest } from "next/server";
import { withAuth } from "@/lib/api";
import { updateUserStyleProfile } from "@/lib/style/analysis";
import { AnalyzeStyleSchema } from "@/lib/style/validation";

export const POST = withAuth(async (request, { userId }) => {
  const body = await request.json();
  const { messages } = AnalyzeStyleSchema.parse(body);
  const result = await updateUserStyleProfile(userId, messages);
  return Response.json(result);
});
```

**Step 2: 重构 style/privacy**

```typescript
/**
 * Style Privacy API
 */

import type { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api";
import { withAuth } from "@/lib/api";
import {
  deleteStyleData,
  getPrivacySettings,
  updatePrivacySettings,
} from "@/lib/style/privacy";

export const GET = withAuth(async (_request, { userId }) => {
  const settings = await getPrivacySettings(userId);
  return apiSuccess(settings);
});

export const PUT = withAuth(async (request, { userId }) => {
  const body = await request.json();
  const settings = await updatePrivacySettings(userId, body);
  return apiSuccess(settings);
});

export const DELETE = withAuth(async (_request, { userId }) => {
  await deleteStyleData(userId);
  return new Response(null, { status: 204 });
});
```

**Step 3: 验证类型检查通过**

Run: `bun run typecheck`
Expected: 通过

**Step 4: 提交**

```bash
git add app/api/style/analyze/route.ts app/api/style/privacy/route.ts
git commit -m "refactor(api): use withAuth in style routes"
```

---

## Task 12: 重构 /api/user 路由组

**Files:**
- Modify: `app/api/user/preferences/route.ts`
- Modify: `app/api/user/persona/route.ts`

**Step 1: 重构 user/preferences**

```typescript
/**
 * User Preferences API
 */

import type { NextRequest } from "next/server";
import type { PersonaPreference } from "@/lib/ai/personas";
import {
  type AIPersona,
  getAvailablePersonas,
  getUserPersonaPreference,
} from "@/lib/ai/personas";
import { withAuth } from "@/lib/api";
import { getUserStyleProfile, type UserStyleProfile } from "@/lib/style/analysis";

interface PreferencesResponse {
  profile: {
    learningStyle?: { preferredFormat?: string; pace?: string };
    style?: UserStyleProfile;
  };
  personaPreference: PersonaPreference;
  availablePersonas: AIPersona[];
}

export const GET = withAuth(async (_request, { userId }) => {
  const [styleProfile, personaPreference, availablePersonas] = await Promise.all([
    getUserStyleProfile(userId),
    getUserPersonaPreference(userId),
    getAvailablePersonas(userId),
  ]);

  const response: PreferencesResponse = {
    profile: {
      learningStyle: { preferredFormat: "mixed", pace: "normal" },
      style: styleProfile ?? undefined,
    },
    personaPreference,
    availablePersonas,
  };

  return Response.json(response);
});
```

**Step 2: 重构 user/persona**

```typescript
/**
 * PUT /api/user/persona - 设置用户选择的 Persona
 */

import type { NextRequest } from "next/server";
import { withAuth } from "@/lib/api";
import { setUserPersonaPreference } from "@/lib/ai/personas";
import { PersonaPreferenceSchema } from "@/lib/ai/personas/validation";

export const PUT = withAuth(async (request, { userId }) => {
  const body = await request.json();
  const { personaSlug } = PersonaPreferenceSchema.parse(body);
  await setUserPersonaPreference(userId, personaSlug);
  return Response.json({ success: true });
});
```

**Step 3: 验证类型检查通过**

Run: `bun run typecheck`
Expected: 通过

**Step 4: 提交**

```bash
git add app/api/user/preferences/route.ts app/api/user/persona/route.ts
git commit -m "refactor(api): use withAuth in user routes"
```

---

## Task 13: 重构 /api/chat-sessions 路由组

**Files:**
- Modify: `app/api/chat-sessions/route.ts`
- Modify: `app/api/chat-sessions/[id]/route.ts`
- Modify: `app/api/chat-sessions/index/route.ts`
- Modify: `app/api/chat-sessions/generate-titles/route.ts`

**Step 1: 逐个重构，使用 withAuth**

参考 Task 8-12 的模式，将每个路由重构为使用 `withAuth`。

**Step 2: 验证类型检查通过**

Run: `bun run typecheck`
Expected: 通过

**Step 3: 提交**

```bash
git add app/api/chat-sessions/
git commit -m "refactor(api): use withAuth in chat-sessions routes"
```

---

## Task 14: 最终验证

**Step 1: 完整类型检查**

Run: `bun run typecheck`
Expected: 0 errors

**Step 2: Lint 检查**

Run: `bun run lint`
Expected: 无严重错误

**Step 3: 构建测试**

Run: `SKIP_ENV_VALIDATION=true bun run build`
Expected: 构建成功

**Step 4: 确认 as any 已清除**

Run: `grep -r "as any" lib/ app/ --include="*.ts" --include="*.tsx"`
Expected: 仅剩 tiptap/markdown.ts 中的 1 处（单独评估）

---

## 完成清单

- [ ] Task 1: 创建 EMAValue 类型定义
- [ ] Task 2: 更新 Schema 使用 EMAValue 类型
- [ ] Task 3: 创建 API 路由辅助函数
- [ ] Task 4: 创建统一 API 响应工具
- [ ] Task 5: 修复 Embedding 类型
- [ ] Task 6: 移除 RAG 模块中的 as any
- [ ] Task 7: 移除 tag-generation-service 中的 as any
- [ ] Task 8: 重构 /api/skills/graph 路由
- [ ] Task 9: 重构 /api/skills/recommend 路由
- [ ] Task 10: 重构 /api/skills/discover 路由
- [ ] Task 11: 重构 /api/style 路由组
- [ ] Task 12: 重构 /api/user 路由组
- [ ] Task 13: 重构 /api/chat-sessions 路由组
- [ ] Task 14: 最终验证
