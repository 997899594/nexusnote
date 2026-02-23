# 技能图系统 2026 现代化修复设计

> **版本**: v1.0
> **状态**: 设计已批准
> **创建日期**: 2026-02-24
> **基于**: Code Review 发现 9 个问题

---

## 概述

将现有技能图系统全面升级至 2026 现代化标准，修复所有发现的 Bug 和架构问题。

**修复范围**: 全部 9 个问题 (P0 × 2, P1 × 2, P2 × 2, P3 × 3)

---

## 第一部分：Bug 修复 (P0)

### 1.1 Profile 页面重复渲染 SkillGraph

**文件**: `app/profile/page.tsx`

**问题**: 第 204-206 行和第 255-258 行重复渲染了 SkillGraph

**修复**:
```diff
- {/* 技能图谱 */}
- <section className="mb-8">
-   <SkillGraph />
- </section>
-
  {/* AI 使用统计 */}
  <section className="mb-8">...</section>

  {/* 技能图谱 */}
  <section className="mb-8">
    <SkillGraph userId={session.user.id} />
  </section>
```

### 1.2 技能关系推理缺少 userId

**文件**: `lib/skills/relationships.ts`, `app/api/skills/discover/route.ts`

**问题**: `discoverAndSaveRelationships()` 没有接收 userId，会推理全系统技能关系

**修复**:
```typescript
// lib/skills/relationships.ts
export async function discoverAndSaveRelationships(
  skillSlugs?: string[],
  userId?: string,  // 新增参数
): Promise<SkillRelationship[]> {
  // 如果提供了 userId，只获取该用户的技能
  let targetSlugs = skillSlugs;
  if (!targetSlugs && userId) {
    const userSkills = await db
      .select({ slug: skills.slug })
      .from(userSkillMastery)
      .innerJoin(skills, eq(userSkillMastery.skillId, skills.id))
      .where(eq(userSkillMastery.userId, userId));
    targetSlugs = userSkills.map((s) => s.slug);
  }
  // ...
}

// app/api/skills/discover/route.ts
discoverAndSaveRelationships(undefined, session.user.id).catch(...)
```

---

## 第二部分：API 标准化 (P1)

### 2.1 统一错误处理

**新文件**: `lib/api/errors.ts`

```typescript
/**
 * 统一 API 错误处理
 * 参考 app/api/chat/route.ts
 */

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

**修改文件**:
- `app/api/skills/graph/route.ts`
- `app/api/skills/discover/route.ts`
- `app/api/skills/recommend/route.ts`

### 2.2 Request Body Zod 验证

**新文件**: `lib/schemas/skills.ts`

```typescript
import { z } from "zod";

export const DiscoverSkillsSchema = z.object({
  limit: z.number().min(1).max(100).optional().default(50),
  sources: z.array(
    z.enum(["conversations", "knowledge", "courses", "flashcards"])
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

---

## 第三部分：性能优化 (P2)

### 3.1 添加 Suspense 边界

**文件**: `app/profile/page.tsx`

```diff
+ import { Suspense } from "react";
+ import { SkillGraphSkeleton } from "@/components/profile/SkillGraphSkeleton";

  {/* 技能图谱 */}
  <section className="mb-8">
+   <Suspense fallback={<SkillGraphSkeleton />}>
      <SkillGraph userId={session.user.id} />
+   </Suspense>
  </section>
```

**新文件**: `components/profile/SkillGraphSkeleton.tsx`

```typescript
export function SkillGraphSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-[var(--shadow-card)] overflow-hidden">
      <div className="px-6 py-4 border-b border-zinc-100">
        <div className="h-6 bg-zinc-200 rounded w-32 animate-pulse" />
      </div>
      <div className="h-[350px] bg-zinc-50 animate-pulse" />
      <div className="px-6 py-3 border-t border-zinc-100" />
    </div>
  );
}
```

### 3.2 移除 useCallback

**文件**: `components/profile/SkillGraph.tsx`

```diff
- const onNodesChange: OnNodesChange = useCallback((changes: NodeChange[]) => {
-   setNodes((nds) => applyNodeChanges(changes, nds));
- }, []);

- const onEdgesChange: OnEdgesChange = useCallback((changes: EdgeChange[]) => {
-   setEdges((eds) => applyEdgeChanges(changes, eds));
- }, []);

+ const onNodesChange = (changes: NodeChange[]) => {
+   setNodes((nds) => applyNodeChanges(changes, nds));
+ };

+ const onEdgesChange = (changes: EdgeChange[]) => {
+   setEdges((eds) => applyEdgeChanges(changes, eds));
+ };
```

React Compiler 会自动优化这些函数。

---

## 第四部分：流式 Agent 改造 (P3)

### 4.1 创建技能发现 Agent

**新文件**: `lib/ai/agents/skills-agent.ts`

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
    const instructions = `你是 NexusNote 的技能发现专家。

你的任务是从用户的学习数据中自动发现和提取技能。

工作流程：
1. 收集用户的对话、笔记、课程、闪卡数据
2. 分析这些数据，识别用户掌握或正在学习的技能
3. 为每个技能评估掌握度 (0-5)
4. 将发现的技能保存到数据库

返回格式：
- 技能名称（简洁准确）
- 技能分类：frontend | backend | ml | design | softskill | other
- 掌握度：0-5 级
- 置信度：0-100

用户 ID: ${options.userId}
数据源: ${options.sources?.join(", ") || "全部"}
`;

    return { instructions, temperature: 0.3 };
  },
});
```

**新文件**: `lib/ai/agents/tools/skills-tools.ts`

```typescript
import { z } from "zod";
import { discoverAndSaveSkills } from "@/lib/skills";

export const discoverAndSaveSkillsTool = {
  description: "从用户数据中发现并保存技能",
  parameters: z.object({
    userId: z.string().describe("用户 ID"),
    limit: z.number().optional().describe("数据限制"),
    sources: z.array(z.enum(["conversations", "knowledge", "courses", "flashcards"])).optional(),
  }),
  execute: async ({ userId, limit, sources }) => {
    const skills = await discoverAndSaveSkills(userId, { limit, sources });
    return {
      count: skills.length,
      skills: skills.map((s) => ({
        name: s.name,
        category: s.category,
        confidence: s.confidence,
      })),
    };
  },
};
```

### 4.2 流式 API 路由

**修改**: `app/api/skills/discover/route.ts`

```typescript
import { createAgentUIStreamResponse, smoothStream, type UIMessage } from "ai";
import { type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { skillsDiscoveryAgent } from "@/lib/ai/agents/skills-agent";
import { DiscoverSkillsSchema } from "@/lib/schemas/skills";
import { handleError, APIError } from "@/lib/api/errors";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      throw new APIError("Unauthorized", 401, "UNAUTHORIZED");
    }

    const body = await request.json();
    const options = DiscoverSkillsSchema.parse(body);

    const messages: UIMessage[] = [
      {
        role: "user",
        content: `请从我的数据中 discover 技能。用户 ID: ${session.user.id}`,
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
        ...options,
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
```

---

## 第五部分：设计系统 (OKLCH 颜色)

### 5.1 颜色映射表

| 用途 | 当前 Tailwind | OKLCH 替换 |
|------|---------------|-----------|
| frontend | `bg-blue-100` / `border-blue-300` / `text-blue-700` | `oklch(0.95 0.03 250)` / `oklch(0.85 0.05 250)` / `oklch(0.45 0.12 250)` |
| backend | `bg-emerald-100` / `border-emerald-300` / `text-emerald-700` | `oklch(0.95 0.04 150)` / `oklch(0.85 0.06 150)` / `oklch(0.45 0.15 150)` |
| ml | `bg-purple-100` / `border-purple-300` / `text-purple-700` | `oklch(0.94 0.06 300)` / `oklch(0.82 0.10 300)` / `oklch(0.40 0.18 300)` |
| design | `bg-pink-100` / `border-pink-300` / `text-pink-700` | `oklch(0.95 0.05 350)` / `oklch(0.85 0.08 350)` / `oklch(0.45 0.15 350)` |
| softskill | `bg-amber-100` / `border-amber-300` / `text-amber-700` | `oklch(0.96 0.04 90)` / `oklch(0.88 0.08 90)` / `oklch(0.50 0.12 90)` |
| default | `bg-zinc-100` / `border-zinc-300` / `text-zinc-700` | `oklch(0.97 0 0)` / `oklch(0.90 0 0)` / `oklch(0.40 0 0)` |

### 5.2 SkillGraph 组件颜色更新

**文件**: `components/profile/SkillGraph.tsx`

```diff
  const getColor = () => {
    switch (data.category) {
      case "frontend":
-       return "bg-blue-100 border-blue-300 text-blue-700";
+       return { bg: "oklch(0.95 0.03 250)", border: "oklch(0.85 0.05 250)", text: "oklch(0.45 0.12 250)" };
      // ... 其他分类类似
    }
  };
```

由于 OKLCH 需要内联样式，建议使用 CSS 变量：

```typescript
// 在 globals.css 中定义
--skill-frontend-bg: oklch(0.95 0.03 250);
--skill-frontend-border: oklch(0.85 0.05 250);
--skill-frontend-text: oklch(0.45 0.12 250);
// ... 其他

// 组件中使用
style={{
  backgroundColor: "var(--skill-frontend-bg)",
  borderColor: "var(--skill-frontend-border)",
  color: "var(--skill-frontend-text)",
}}
```

---

## 第六部分：文件结构

```
技能图系统 2026 修复后的文件结构：

lib/
├── api/
│   └── errors.ts                        # 新增：统一错误处理
├── ai/
│   └── agents/
│       ├── skills-agent.ts              # 新增：技能发现 Agent
│       └── tools/
│           └── skills-tools.ts          # 新增：技能工具
├── schemas/
│   └── skills.ts                        # 新增：Zod 验证 Schema
└── skills/
    ├── discovery.ts                     # 修改：userId 参数
    ├── relationships.ts                 # 修改：userId 参数
    ├── graph.ts                         # 保持
    └── index.ts                         # 导出

app/
├── api/
│   └── skills/
│       ├── graph/
│       │   └── route.ts                 # 修改：统一错误处理 + Zod 验证
│       ├── discover/
│       │   └── route.ts                 # 修改：流式 Agent
│       └── recommend/
│           └── route.ts                 # 修改：统一错误处理 + Zod 验证
└── profile/
    └── page.tsx                         # 修改：删除重复 + Suspense

components/
├── profile/
│   ├── SkillGraph.tsx                   # 修改：移除 useCallback + OKLCH
│   └── SkillGraphSkeleton.tsx           # 新增：骨架屏

styles/
└── globals.css                          # 修改：添加技能颜色变量
```

---

## 第七部分：实施顺序

1. **Phase 1**: Bug 修复 (P0) - 30 分钟
2. **Phase 2**: API 标准化 (P1) - 1 小时
3. **Phase 3**: 性能优化 (P2) - 30 分钟
4. **Phase 4**: 流式 Agent 改造 (P3) - 2 小时
5. **Phase 5**: 设计系统 (OKLCH) - 1 小时
6. **Phase 6**: 测试与验证 - 1 小时

**总计**: 约 6 小时

---

## 第八部分：验收标准

- [ ] Profile 页面只有一个 SkillGraph
- [ ] 技能关系推理只针对用户技能
- [ ] 所有 API 使用统一错误处理
- [ ] 所有 Request Body 用 Zod 验证
- [ ] SkillGraph 有 Suspense 边界和骨架屏
- [ ] 无不必要的 useCallback
- [ ] 技能发现支持流式响应
- [ ] 使用 OKLCH 颜色变量
- [ ] TypeScript 编译通过
- [ ] pnpm typecheck 通过

---

**设计者**: Claude Opus 4.6
**审核者**: 待定
**最后更新**: 2026-02-24
