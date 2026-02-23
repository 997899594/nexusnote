# 技能图系统 2026 现代化实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将技能图系统全面升级至 2026 现代化标准，修复 9 个发现的问题

**Architecture:**
- 统一 API 错误处理和 Zod 验证
- 流式 Agent 架构用于技能发现
- Suspense 边界和骨架屏
- OKLCH 颜色系统

**Tech Stack:** Next.js 16, React 19, AI SDK 6, Drizzle ORM, @xyflow/react

---

## Task 1: Bug 修复 - 删除重复的 SkillGraph

**Files:**
- Modify: `app/profile/page.tsx:204-206`

**Step 1: 删除重复的 SkillGraph**

```typescript
// 删除这 4 行 (Line 204-206 和空行)
- {/* 技能图谱 */}
- <section className="mb-8">
-   <SkillGraph />
- </section>
```

**Step 2: 验证页面只有一个 SkillGraph**

搜索确认 `app/profile/page.tsx` 中只有一个 `<SkillGraph` 调用

**Step 3: 类型检查**

Run: `pnpm typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add app/profile/page.tsx
git commit -m "fix: remove duplicate SkillGraph in profile page"
```

---

## Task 2: Bug 修复 - 技能关系推理添加 userId

**Files:**
- Modify: `lib/skills/relationships.ts:180-193`
- Modify: `app/api/skills/discover/route.ts:29`

**Step 1: 修改 discoverAndSaveRelationships 函数签名**

```typescript
// lib/skills/relationships.ts Line 180
export async function discoverAndSaveRelationships(
  skillSlugs?: string[],
  userId?: string,  // 新增参数
): Promise<SkillRelationship[]> {
```

**Step 2: 修改函数内部逻辑**

```typescript
// lib/skills/relationships.ts Line 184-192，替换为：
// 如果没有指定技能，获取技能
let targetSlugs = skillSlugs;
if (!targetSlugs) {
  // 如果提供了 userId，只获取该用户的技能
  if (userId) {
    const userSkills = await db
      .select({ slug: skills.slug })
      .from(userSkillMastery)
      .innerJoin(skills, eq(userSkillMastery.skillId, skills.id))
      .where(eq(userSkillMastery.userId, userId));
    targetSlugs = userSkills.map((s) => s.slug);
  } else {
    // 否则获取所有技能
    const allSkills = await db.select({ slug: skills.slug }).from(skills);
    targetSlugs = allSkills.map((s) => s.slug);
  }
}
```

**Step 3: 添加导入**

```typescript
// lib/skills/relationships.ts 顶部，确保有：
import { userSkillMastery } from "@/db/schema";
```

**Step 4: 修改 API 调用**

```typescript
// app/api/skills/discover/route.ts Line 29，替换为：
discoverAndSaveRelationships(undefined, session.user.id).catch((error) => {
  console.error("[API] /api/skills/discover relationships error:", error);
});
```

**Step 5: 类型检查**

Run: `pnpm typecheck`
Expected: PASS

**Step 6: Commit**

```bash
git add lib/skills/relationships.ts app/api/skills/discover/route.ts
git commit -m "fix: pass userId to discoverAndSaveRelationships"
```

---

## Task 3: API 标准化 - 创建统一错误处理

**Files:**
- Create: `lib/api/errors.ts`

**Step 1: 创建错误处理模块**

```typescript
/**
 * 统一 API 错误处理
 * 参考 app/api/chat/route.ts
 */

import { type NextRequest, NextResponse } from "next/server";

export class APIError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string,
  ) {
    super(message);
    this.name = "APIError";
  }
}

export function errorResponse(
  message: string,
  statusCode: number,
  code: string,
) {
  return NextResponse.json(
    { error: { message, code } },
    { status: statusCode },
  );
}

export function handleError(error: unknown): NextResponse {
  console.error("[API Error]", error);

  if (error instanceof APIError) {
    return errorResponse(error.message, error.statusCode, error.code);
  }

  if (error instanceof Error) {
    if (error.name === "ZodError") {
      return errorResponse("请求参数错误", 400, "VALIDATION_ERROR");
    }
    return errorResponse(error.message, 500, "INTERNAL_ERROR");
  }

  return errorResponse("未知错误", 500, "UNKNOWN_ERROR");
}
```

**Step 2: 创建导出文件**

```typescript
// lib/api/index.ts
export * from "./errors";
```

**Step 3: 类型检查**

Run: `pnpm typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add lib/api/errors.ts lib/api/index.ts
git commit -m "feat: add unified API error handling"
```

---

## Task 4: API 标准化 - 创建 Zod 验证 Schema

**Files:**
- Create: `lib/schemas/skills.ts`

**Step 1: 创建技能相关 Schema**

```typescript
/**
 * 技能 API Zod 验证 Schema
 */

import { z } from "zod";

export const DiscoverSkillsSchema = z.object({
  limit: z.number().min(1).max(100).optional().default(50),
  sources: z.array(
    z.enum(["conversations", "knowledge", "courses", "flashcards"]),
  ).optional().default(["conversations", "knowledge", "courses", "flashcards"]),
});

export const GraphQuerySchema = z.object({
  includeUnlocked: z.coerce.boolean().optional().default(true),
  maxDepth: z.coerce.number().min(1).max(5).optional().default(2),
});

export const RecommendQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(50).optional().default(10),
});
```

**Step 2: 类型检查**

Run: `pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add lib/schemas/skills.ts
git commit -m "feat: add skills API Zod validation schemas"
```

---

## Task 5: API 标准化 - 更新 /api/skills/graph

**Files:**
- Modify: `app/api/skills/graph/route.ts`

**Step 1: 重写 API 路由**

```typescript
/**
 * GET /api/skills/graph - 获取用户技能图数据
 *
 * 返回 XYFlow 格式的 nodes 和 edges
 */

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getUserSkillGraphData } from "@/lib/skills";
import { handleError, APIError } from "@/lib/api";
import { GraphQuerySchema } from "@/lib/schemas/skills";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      throw new APIError("Unauthorized", 401, "UNAUTHORIZED");
    }

    // 验证查询参数
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const options = GraphQuerySchema.parse(searchParams);

    const graphData = await getUserSkillGraphData(session.user.id, options);

    return Response.json(graphData);
  } catch (error) {
    return handleError(error);
  }
}
```

**Step 2: 类型检查**

Run: `pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add app/api/skills/graph/route.ts
git commit -m "refactor: standardize /api/skills/graph error handling"
```

---

## Task 6: API 标准化 - 更新 /api/skills/recommend

**Files:**
- Modify: `app/api/skills/recommend/route.ts`

**Step 1: 重写 API 路由**

```typescript
/**
 * GET /api/skills/recommend - 获取技能推荐
 */

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getRecommendedSkills } from "@/lib/skills";
import { handleError, APIError } from "@/lib/api";
import { RecommendQuerySchema } from "@/lib/schemas/skills";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      throw new APIError("Unauthorized", 401, "UNAUTHORIZED");
    }

    // 验证查询参数
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const { limit } = RecommendQuerySchema.parse(searchParams);

    const recommendations = await getRecommendedSkills(session.user.id, limit);

    return Response.json({
      recommendations,
      count: recommendations.length,
    });
  } catch (error) {
    return handleError(error);
  }
}
```

**Step 2: 类型检查**

Run: `pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add app/api/skills/recommend/route.ts
git commit -m "refactor: standardize /api/skills/recommend error handling"
```

---

## Task 7: 性能优化 - 创建骨架屏组件

**Files:**
- Create: `components/profile/SkillGraphSkeleton.tsx`

**Step 1: 创建骨架屏组件**

```typescript
/**
 * SkillGraph Skeleton - 加载状态骨架屏
 */

export function SkillGraphSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-[var(--shadow-card)] overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-zinc-100">
        <div className="h-6 bg-zinc-200 rounded w-32 animate-pulse" />
        <div className="h-4 bg-zinc-100 rounded w-48 mt-2 animate-pulse" />
      </div>

      {/* Graph area */}
      <div className="h-[350px] bg-zinc-50 flex items-center justify-center">
        <div className="animate-pulse text-zinc-300">
          <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
      </div>

      {/* Legend */}
      <div className="px-6 py-3 border-t border-zinc-100 flex gap-4">
        <div className="h-3 w-12 bg-zinc-100 rounded animate-pulse" />
        <div className="h-3 w-12 bg-zinc-100 rounded animate-pulse" />
        <div className="h-3 w-12 bg-zinc-100 rounded animate-pulse" />
      </div>
    </div>
  );
}
```

**Step 2: 类型检查**

Run: `pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add components/profile/SkillGraphSkeleton.tsx
git commit -m "feat: add SkillGraph skeleton component"
```

---

## Task 8: 性能优化 - 添加 Suspense 边界

**Files:**
- Modify: `app/profile/page.tsx`

**Step 1: 添加 Suspense 和骨架屏导入**

```typescript
// app/profile/page.tsx 顶部添加
import { Suspense } from "react";
import { SkillGraphSkeleton } from "@/components/profile/SkillGraphSkeleton";
```

**Step 2: 包装 SkillGraph**

```typescript
// app/profile/page.tsx 找到 SkillGraph 部分，修改为：
{/* 技能图谱 */}
<section className="mb-8">
  <Suspense fallback={<SkillGraphSkeleton />}>
    <SkillGraph userId={session.user.id} />
  </Suspense>
</section>
```

**Step 3: 类型检查**

Run: `pnpm typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add app/profile/page.tsx
git commit -m "perf: add Suspense boundary to SkillGraph"
```

---

## Task 9: 性能优化 - 移除 useCallback

**Files:**
- Modify: `components/profile/SkillGraph.tsx:180-186`

**Step 1: 移除 useCallback 包装**

```typescript
// 找到 onNodesChange 和 onEdgesChange，移除 useCallback

// 修改前：
// const onNodesChange: OnNodesChange = useCallback((changes: NodeChange[]) => {
//   setNodes((nds) => applyNodeChanges(changes, nds));
// }, []);

// 修改后：
const onNodesChange = (changes: NodeChange[]) => {
  setNodes((nds) => applyNodeChanges(changes, nds));
};

// 修改前：
// const onEdgesChange: OnEdgesChange = useCallback((changes: EdgeChange[]) => {
//   setEdges((eds) => applyEdgeChanges(changes, eds));
// }, []);

// 修改后：
const onEdgesChange = (changes: EdgeChange[]) => {
  setEdges((eds) => applyEdgeChanges(changes, eds));
};
```

**Step 2: 移除 useCallback 导入（如果没有其他地方使用）**

```typescript
// 如果 import 中 useCallback 是唯一使用的，移除它
// import { useCallback, ... } -> import { ... }
```

**Step 3: 类型检查**

Run: `pnpm typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add components/profile/SkillGraph.tsx
git commit -m "refactor: remove unnecessary useCallback (React Compiler)"
```

---

## Task 10: 流式 Agent - 创建技能工具

**Files:**
- Create: `lib/ai/agents/tools/skills-tools.ts`

**Step 1: 创建技能工具**

```typescript
/**
 * 技能发现 Agent 工具
 */

import { z } from "zod";
import { discoverAndSaveSkills } from "@/lib/skills";

export const discoverAndSaveSkillsTool = {
  description: "从用户数据中发现并保存技能到数据库",
  parameters: z.object({
    userId: z.string().describe("用户 ID"),
    limit: z.number().min(1).max(100).optional().describe("分析的数据条数限制"),
    sources: z.array(
      z.enum(["conversations", "knowledge", "courses", "flashcards"])
    ).optional().describe("数据来源列表"),
  }),
  execute: async ({ userId, limit = 50, sources }) => {
    const skills = await discoverAndSaveSkills(userId, { limit, sources });

    return {
      success: true,
      count: skills.length,
      skills: skills.map((s) => ({
        name: s.name,
        category: s.category,
        confidence: s.confidence,
        level: Math.ceil(s.confidence / 20),
      })),
    };
  },
};
```

**Step 2: 类型检查**

Run: `pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add lib/ai/agents/tools/skills-tools.ts
git commit -m "feat: add skills discovery tool for Agent"
```

---

## Task 11: 流式 Agent - 创建技能发现 Agent

**Files:**
- Create: `lib/ai/agents/skills-agent.ts`

**Step 1: 创建技能发现 Agent**

```typescript
/**
 * 技能发现 Agent - 流式 AI 技能提取
 */

import { ToolLoopAgent } from "ai";
import { aiProvider } from "@/lib/ai/core";
import { discoverAndSaveSkillsTool } from "./tools/skills-tools";

export const skillsDiscoveryAgent = new ToolLoopAgent({
  id: "nexusnote-skills-discovery",
  model: aiProvider.proModel,
  tools: [discoverAndSaveSkillsTool],
  prepareCall: ({ options }) => {
    const userId = options?.userId as string || "unknown";
    const sources = options?.sources as string[] || ["全部"];
    const limit = options?.limit as number || 50;

    const instructions = `你是 NexusNote 的技能发现专家。

你的任务是从用户的学习数据中自动发现和提取技能。

工作流程：
1. 收集用户的对话、笔记、课程、闪卡数据
2. 分析这些数据，识别用户掌握或正在学习的技能
3. 为每个技能评估掌握度 (0-5) 和置信度 (0-100)
4. 将发现的技能保存到数据库

技能分类：
- frontend: 前端开发相关 (React, Vue, CSS, TypeScript...)
- backend: 后端开发相关 (Node.js, Python, PostgreSQL...)
- ml: 机器学习/AI相关 (PyTorch, TensorFlow, NLP...)
- design: 设计相关 (UI/UX, Figma, 色彩理论...)
- softskill: 软技能 (沟通, 团队协作, 时间管理...)
- other: 其他领域

返回格式：使用 discoverAndSaveSkills 工具保存发现的技能。

参数说明：
- userId: ${userId}
- sources: ${sources.join(", ")}
- limit: ${limit}
`;

    return {
      instructions,
      temperature: 0.3,
    };
  },
});
```

**Step 2: 类型检查**

Run: `pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add lib/ai/agents/skills-agent.ts
git commit -m "feat: add skills discovery Agent"
```

---

## Task 12: 流式 Agent - 更新 discover API

**Files:**
- Modify: `app/api/skills/discover/route.ts`

**Step 1: 重写为流式 Agent API**

```typescript
/**
 * POST /api/skills/discover - 流式技能发现
 */

import { createAgentUIStreamResponse, smoothStream, type UIMessage } from "ai";
import { type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { skillsDiscoveryAgent } from "@/lib/ai/agents/skills-agent";
import { handleError, APIError } from "@/lib/api";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      throw new APIError("Unauthorized", 401, "UNAUTHORIZED");
    }

    const body = await request.json();

    const messages: UIMessage[] = [
      {
        role: "user",
        content: `请从我的学习数据中发现技能。`,
      },
    ];

    return createAgentUIStreamResponse({
      agent: skillsDiscoveryAgent,
      uiMessages: messages,
      experimental_transform: smoothStream({
        chunking: new Intl.Segmenter("zh-CN", { granularity: "grapheme" }),
      }),
      context: {
        userId: session.user.id,
        limit: body.limit || 50,
        sources: body.sources,
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
```

**Step 2: 类型检查**

Run: `pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add app/api/skills/discover/route.ts
git commit -m "feat: convert skills discover to streaming Agent"
```

---

## Task 13: 设计系统 - 添加 OKLCH 颜色变量

**Files:**
- Modify: `app/globals.css` 或 `styles/globals.css`

**Step 1: 添加技能颜色变量**

找到 CSS 文件中的颜色变量定义区域，添加：

```css
:root {
  /* ... 现有变量 ... */

  /* 技能图颜色 (OKLCH) */
  --skill-frontend-bg: oklch(0.95 0.03 250);
  --skill-frontend-border: oklch(0.85 0.05 250);
  --skill-frontend-text: oklch(0.45 0.12 250);

  --skill-backend-bg: oklch(0.95 0.04 150);
  --skill-backend-border: oklch(0.85 0.06 150);
  --skill-backend-text: oklch(0.45 0.15 150);

  --skill-ml-bg: oklch(0.94 0.06 300);
  --skill-ml-border: oklch(0.82 0.10 300);
  --skill-ml-text: oklch(0.40 0.18 300);

  --skill-design-bg: oklch(0.95 0.05 350);
  --skill-design-border: oklch(0.85 0.08 350);
  --skill-design-text: oklch(0.45 0.15 350);

  --skill-softskill-bg: oklch(0.96 0.04 90);
  --skill-softskill-border: oklch(0.88 0.08 90);
  --skill-softskill-text: oklch(0.50 0.12 90);

  --skill-default-bg: oklch(0.97 0 0);
  --skill-default-border: oklch(0.90 0 0);
  --skill-default-text: oklch(0.40 0 0);
}
```

**Step 2: 构建**

Run: `pnpm build`
Expected: PASS

**Step 3: Commit**

```bash
git add app/globals.css
git commit -m "style: add OKLCH color variables for skill categories"
```

---

## Task 14: 设计系统 - 更新 SkillGraph 使用 OKLCH

**Files:**
- Modify: `components/profile/SkillGraph.tsx:77-92`

**Step 1: 修改 MasteryNode 组件使用内联样式**

```typescript
// components/profile/SkillGraph.tsx MasteryNode 组件

function MasteryNode({ data, selected }: MasteryNodeProps) {
  const IconComponent = useMemo(() => {
    if (data.icon && data.icon in LucideIcons) {
      return LucideIcons[data.icon as keyof typeof LucideIcons] as React.ComponentType<{ className?: string }>;
    }
    return LucideIcons.Lightbulb;
  }, [data.icon]);

  // 使用 OKLCH 颜色变量
  const getColors = () => {
    switch (data.category) {
      case "frontend":
        return {
          bg: "var(--skill-frontend-bg)",
          border: "var(--skill-frontend-border)",
          text: "var(--skill-frontend-text)",
        };
      case "backend":
        return {
          bg: "var(--skill-backend-bg)",
          border: "var(--skill-backend-border)",
          text: "var(--skill-backend-text)",
        };
      case "ml":
        return {
          bg: "var(--skill-ml-bg)",
          border: "var(--skill-ml-border)",
          text: "var(--skill-ml-text)",
        };
      case "design":
        return {
          bg: "var(--skill-design-bg)",
          border: "var(--skill-design-border)",
          text: "var(--skill-design-text)",
        };
      case "softskill":
        return {
          bg: "var(--skill-softskill-bg)",
          border: "var(--skill-softskill-border)",
          text: "var(--skill-softskill-text)",
        };
      default:
        return {
          bg: "var(--skill-default-bg)",
          border: "var(--skill-default-border)",
          text: "var(--skill-default-text)",
        };
    }
  };

  const colors = getColors();
  const colorClass = cn(
    "px-4 py-3 rounded-xl border-2 shadow-sm transition-all min-w-[140px]",
    selected && "ring-2 ring-offset-2 ring-[var(--color-accent)]",
  );

  return (
    <div
      className={colorClass}
      style={{
        backgroundColor: colors.bg,
        borderColor: colors.border,
        color: colors.text,
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        <IconComponent className="w-4 h-4 flex-shrink-0" style={{ color: colors.text }} />
        <span className="font-semibold text-sm truncate">{data.name}</span>
      </div>
      <div className="flex items-center justify-between text-xs opacity-75">
        <span>Lv.{data.level}</span>
        {data.description && (
          <span className="truncate max-w-[80px]" title={data.description}>
            {data.description}
          </span>
        )}
      </div>
      <div className="mt-2 h-1.5 bg-black/10 rounded-full overflow-hidden">
        <div
          className="h-full transition-all"
          style={{
            width: `${(data.level / 5) * 100}%`,
            backgroundColor: colors.text,
            opacity: 0.7,
          }}
        />
      </div>
    </div>
  );
}
```

**Step 2: 更新 MiniMap 颜色**

```typescript
// components/profile/SkillGraph.tsx MiniMap 的 nodeColor 属性

<MiniMap
  nodeColor={(node) => {
    if (node.type === "suggestedNode") return "var(--skill-default-bg)";
    const data = node.data;
    switch (data.category as string) {
      case "frontend": return "var(--skill-frontend-bg)";
      case "backend": return "var(--skill-backend-bg)";
      case "ml": return "var(--skill-ml-bg)";
      case "design": return "var(--skill-design-bg)";
      case "softskill": return "var(--skill-softskill-bg)";
      default: return "var(--skill-default-bg)";
    }
  }}
  className="!bg-white !border-zinc-200"
/>
```

**Step 3: 类型检查**

Run: `pnpm typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add components/profile/SkillGraph.tsx
git commit -m "style: update SkillGraph to use OKLCH color variables"
```

---

## Task 15: 验证与测试

**Step 1: 完整类型检查**

Run: `pnpm typecheck`
Expected: PASS，无错误

**Step 2: 构建**

Run: `pnpm build`
Expected: PASS，无警告

**Step 3: 检查修改的文件列表**

确认以下文件已修改：
- [x] `app/profile/page.tsx` - 删除重复 + Suspense
- [x] `lib/skills/relationships.ts` - userId 参数
- [x] `app/api/skills/graph/route.ts` - 统一错误处理
- [x] `app/api/skills/recommend/route.ts` - 统一错误处理
- [x] `app/api/skills/discover/route.ts` - 流式 Agent
- [x] `components/profile/SkillGraph.tsx` - 移除 useCallback + OKLCH
- [x] `app/globals.css` - OKLCH 变量

**Step 4: 新建文件列表**

确认以下文件已创建：
- [x] `lib/api/errors.ts`
- [x] `lib/api/index.ts`
- [x] `lib/schemas/skills.ts`
- [x] `components/profile/SkillGraphSkeleton.tsx`
- [x] `lib/ai/agents/tools/skills-tools.ts`
- [x] `lib/ai/agents/skills-agent.ts`

**Step 5: 创建最终 commit**

```bash
git add docs/plans/2026-02-24-skill-graph-2026-modernization-*.md
git commit -m "docs: add skill graph 2026 modernization design and plan"
```

---

## 验收标准

- [ ] Profile 页面只有一个 SkillGraph
- [ ] 技能关系推理只针对用户技能
- [ ] 所有 API 使用统一错误处理
- [ ] 所有 Request/Query 参数用 Zod 验证
- [ ] SkillGraph 有 Suspense 边界和骨架屏
- [ ] 无不必要的 useCallback
- [ ] 技能发现支持流式响应
- [ ] 使用 OKLCH 颜色变量
- [ ] `pnpm typecheck` 通过
- [ ] `pnpm build` 通过

---

**计划创建时间**: 2026-02-24
**预计实施时间**: 约 6 小时
**任务数量**: 15 个任务
