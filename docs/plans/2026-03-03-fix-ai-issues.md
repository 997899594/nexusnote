# AI Tools 修复实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** 修复 AI Tools 的 Critical 和 Important 问题，确保工具实现完整且安全

**Architecture:**
1. Tools 必须有完整的 execute 实现
2. 服务端代码不能通过 HTTP 调用自己的 API
3. 用户数据操作必须验证权限

**Tech Stack:** Next.js 16, AI SDK v6, Drizzle ORM, TypeScript

---

## Task 1: 修复 suggestOptions 缺少 execute

**Files:**
- Modify: `lib/ai/tools/interview/index.ts:149-152`

**Step 1: 添加 execute 函数**

在 `suggestOptions` tool 定义中添加 execute 函数：

```typescript
suggestOptions: tool({
  description: "展示选项。每轮回复后调用。",
  inputSchema: SuggestOptionsSchema,
  execute: async ({ options }) => {
    // 这是一个客户端展示工具，execute 只需返回选项
    // AI SDK 会停止循环，等待用户选择
    return {
      success: true,
      options,
      message: "请选择一个选项或输入自定义内容",
    };
  },
}),
```

**Step 2: 验证类型检查**

Run: `bun run typecheck`
Expected: 无错误

**Step 3: Commit**

```bash
git add lib/ai/tools/interview/index.ts
git commit -m "fix(ai): add execute function to suggestOptions tool

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 2: 修复 discoverSkillsTool 调用方式

**Files:**
- Modify: `lib/ai/tools/skills/discovery.ts`
- Read: `lib/skills/discovery.ts` (了解底层函数)

**Step 1: 修改为直接调用底层函数**

```typescript
/**
 * Skills Tools - 技能发现工具
 */

import { tool } from "ai";
import { z } from "zod";
import { discoverAndSaveSkills } from "@/lib/skills/discovery";

export const DiscoverSkillsToolSchema = z.object({
  limit: z.number().min(1).max(100).optional().default(50).describe("数据条数限制"),
  sources: z
    .array(z.enum(["conversations", "knowledge", "courses"]))
    .optional()
    .describe("数据来源列表"),
});

export type DiscoverSkillsToolInput = z.infer<typeof DiscoverSkillsToolSchema>;

// 从 context 获取 userId 的接口
interface ToolContext {
  userId: string;
}

/**
 * 创建 discoverSkills tool，绑定 userId
 */
export function createDiscoverSkillsTool(userId: string) {
  return tool({
    description: "从用户的学习数据中发现并提取技能",
    inputSchema: DiscoverSkillsToolSchema,
    execute: async ({ limit = 50, sources }) => {
      try {
        const skills = await discoverAndSaveSkills(userId, {
          limit,
          sources: sources as Array<"conversations" | "knowledge" | "courses">,
        });

        return {
          success: true,
          count: skills.length,
          skills: skills.map((s) => ({
            name: s.name,
            category: s.category,
            confidence: s.confidence,
          })),
        };
      } catch (error) {
        console.error("[Tool] discoverSkills error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          skills: [],
          count: 0,
        };
      }
    },
  });
}

// 向后兼容：保留旧的无 userId 版本（标记为 deprecated）
export const discoverSkillsTool = tool({
  description: "[DEPRECATED] 使用 createDiscoverSkillsTool(userId) 代替",
  inputSchema: DiscoverSkillsToolSchema,
  execute: async () => {
    console.warn("[Tool] discoverSkillsTool is deprecated. Use createDiscoverSkillsTool(userId) instead.");
    return {
      success: false,
      error: "Tool requires userId context. Use createDiscoverSkillsTool(userId).",
      skills: [],
      count: 0,
    };
  },
});
```

**Step 2: 更新 SKILLS Agent 使用 factory**

修改 `lib/ai/agents/skills.ts`:

```typescript
/**
 * SKILLS Agent - 技能发现
 */

import { stepCountIs, ToolLoopAgent, type ToolSet } from "ai";
import { aiProvider } from "../core";
import type { PersonalizationOptions } from "./chat";
import { createDiscoverSkillsTool } from "../tools/skills";

// ... INSTRUCTIONS 保持不变 ...

export interface SkillsAgentOptions extends PersonalizationOptions {
  userId: string;
}

/**
 * 创建 SKILLS Agent
 */
export function createSkillsAgent(options: SkillsAgentOptions) {
  const additionalInstructions = options
    ? [options.personaPrompt || "", options.userContext || ""]
        .filter((s) => s)
        .join("\n")
    : undefined;

  const fullInstructions = additionalInstructions
    ? `${additionalInstructions}\n\n${INSTRUCTIONS.skills}`
    : INSTRUCTIONS.skills;

  const skillsTools = {
    discoverSkills: createDiscoverSkillsTool(options.userId),
  } as ToolSet;

  return new ToolLoopAgent({
    id: "nexusnote-skills",
    model: aiProvider.proModel,
    instructions: fullInstructions,
    tools: skillsTools,
    stopWhen: stepCountIs(20),
  });
}
```

**Step 3: 更新 agents/index.ts**

```typescript
// 更新 getAgent 中的 SKILLS case
case "SKILLS": {
  // SKILLS agent 需要 userId
  const personalization = options as PersonalizationOptions | undefined;
  if (!personalization?.userId) {
    throw new Error("SKILLS agent requires userId in options");
  }
  return createSkillsAgent({
    ...personalization,
    userId: personalization.userId,
  });
}
```

**Step 4: 验证类型检查**

Run: `bun run typecheck`
Expected: 无错误

**Step 5: Commit**

```bash
git add lib/ai/tools/skills/discovery.ts lib/ai/agents/skills.ts lib/ai/agents/index.ts
git commit -m "fix(ai): use direct function call instead of HTTP fetch in discoverSkills

- Add createDiscoverSkillsTool(userId) factory
- Update SKILLS agent to use factory
- Deprecate old discoverSkillsTool

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 3: 修复 webSearchTool 返回假数据

**Files:**
- Modify: `lib/ai/tools/chat/web-search.ts`

**Step 1: 实现真实搜索或抛出明确错误**

```typescript
/**
 * Chat Tools - 网页搜索
 */

import { tool } from "ai";
import { z } from "zod";

export const WebSearchSchema = z.object({
  query: z.string().min(1).max(500),
  limit: z.number().int().min(1).max(10).default(5),
});

export type WebSearchInput = z.infer<typeof WebSearchSchema>;

export const webSearchTool = tool({
  description: "搜索互联网获取最新信息",
  inputSchema: WebSearchSchema,
  execute: async (args) => {
    // 检查是否配置了搜索 API
    const searchApiKey = process.env.TAVILY_API_KEY || process.env.SERPER_API_KEY;

    if (!searchApiKey) {
      // 未配置时返回明确错误，而不是假数据
      console.warn("[Tool] webSearch: No search API key configured");
      return {
        success: false,
        error: "搜索服务未配置。请联系管理员配置 TAVILY_API_KEY 或 SERPER_API_KEY。",
        query: args.query,
        results: [],
      };
    }

    try {
      // 使用 Tavily API (优先)
      if (process.env.TAVILY_API_KEY) {
        return await searchWithTavily(args.query, args.limit);
      }

      // 回退到 Serper
      if (process.env.SERPER_API_KEY) {
        return await searchWithSerper(args.query, args.limit);
      }

      return {
        success: false,
        error: "搜索服务配置错误",
        results: [],
      };
    } catch (error) {
      console.error("[Tool] webSearch error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "搜索服务暂不可用",
        results: [],
      };
    }
  },
});

/**
 * 使用 Tavily API 搜索
 */
async function searchWithTavily(query: string, limit: number) {
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.TAVILY_API_KEY}`,
    },
    body: JSON.stringify({
      query,
      max_results: limit,
      include_answer: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`Tavily API error: ${response.statusText}`);
  }

  const data = await response.json();

  return {
    success: true,
    query,
    answer: data.answer || null,
    results: (data.results || []).map((r: { title: string; url: string; content: string }) => ({
      title: r.title,
      url: r.url,
      snippet: r.content,
    })),
  };
}

/**
 * 使用 Serper API 搜索
 */
async function searchWithSerper(query: string, limit: number) {
  const response = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": process.env.SERPER_API_KEY!,
    },
    body: JSON.stringify({
      q: query,
      num: limit,
    }),
  });

  if (!response.ok) {
    throw new Error(`Serper API error: ${response.statusText}`);
  }

  const data = await response.json();

  return {
    success: true,
    query,
    results: (data.organic || []).map((r: { title: string; link: string; snippet: string }) => ({
      title: r.title,
      url: r.link,
      snippet: r.snippet,
    })),
  };
}
```

**Step 2: 验证类型检查**

Run: `bun run typecheck`
Expected: 无错误

**Step 3: Commit**

```bash
git add lib/ai/tools/chat/web-search.ts
git commit -m "fix(ai): implement real web search with Tavily/Serper APIs

- Return clear error when API not configured
- Add Tavily API integration
- Add Serper API as fallback
- Remove mock data

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 4: 修复 mindMap/summarize 返回假数据

**Files:**
- Modify: `lib/ai/tools/learning/enhance.ts`

**Step 1: 使用 LLM 实现真实功能**

```typescript
/**
 * Learning Tools - 学习增强工具
 */

import { generateObject } from "ai";
import { tool } from "ai";
import { z } from "zod";
import { aiProvider } from "@/lib/ai/core";

// MindMap Schema
const MindMapSchema = z.object({
  topic: z.string(),
  nodes: z.object({
    id: z.string(),
    label: z.string(),
    children: z.array(z.lazy(() => MindMapSchema.shape.nodes)),
  }),
});

export const mindMapTool = tool({
  description: `用于将非结构化的文本转化为结构化图谱。
  适用于：1. 解释复杂的系统架构或家族树；2. 用户似乎迷失在长文本中，需要全局视角时。`,
  inputSchema: z.object({
    topic: z.string().describe("中心主题"),
    content: z.string().optional().describe("要组织的内容"),
    maxDepth: z.number().min(1).max(4).default(3).describe("最大层级深度"),
    layout: z.enum(["radial", "tree", "mindmap"]).default("mindmap").describe("布局类型"),
  }),
  execute: async ({ topic, content, maxDepth, layout }) => {
    try {
      const result = await generateObject({
        model: aiProvider.chatModel,
        schema: MindMapSchema,
        prompt: `请根据以下信息生成一个思维导图结构。

主题: ${topic}
${content ? `内容: ${content.slice(0, 2000)}` : ""}

要求：
1. 以主题为中心节点
2. 最大层级深度: ${maxDepth}
3. 每个节点要有清晰的 id 和 label
4. 子节点按逻辑分组
5. 每个父节点最多 5 个子节点`,
        temperature: 0.3,
      });

      return {
        success: true,
        mindMap: {
          topic,
          maxDepth,
          layout,
          hasContent: !!content,
          nodes: result.object.nodes,
        },
      };
    } catch (error) {
      console.error("[Tool] mindMap error:", error);
      return {
        success: false,
        error: "生成思维导图失败",
        mindMap: null,
      };
    }
  },
});

// Summary Schema
const SummarySchema = z.object({
  mainPoints: z.array(z.string()).describe("主要要点"),
  summary: z.string().describe("摘要内容"),
  keyTakeaways: z.array(z.string()).describe("关键要点"),
});

export const summarizeTool = tool({
  description: `用于降低认知负荷。
  适用于：1. 用户面对长文档显得不知所措；2. 需要快速回顾前文要点时。`,
  inputSchema: z.object({
    content: z.string().describe("要摘要的内容"),
    length: z.enum(["brief", "medium", "detailed"]).default("medium").describe("摘要长度"),
    style: z
      .enum(["bullet_points", "paragraph", "key_takeaways"])
      .default("bullet_points")
      .describe("摘要风格"),
  }),
  execute: async ({ content, length, style }) => {
    try {
      const lengthGuide = {
        brief: "50-100 字",
        medium: "150-250 字",
        detailed: "300-500 字",
      };

      const styleGuide = {
        bullet_points: "使用要点列表形式",
        paragraph: "使用段落形式",
        key_takeaways: "聚焦关键收获",
      };

      const result = await generateObject({
        model: aiProvider.chatModel,
        schema: SummarySchema,
        prompt: `请总结以下内容：

${content.slice(0, 4000)}

要求：
1. 摘要长度: ${lengthGuide[length]}
2. 摘要风格: ${styleGuide[style]}
3. 提取 3-5 个主要要点
4. 提取 2-3 个关键收获`,
        temperature: 0.3,
      });

      return {
        success: true,
        summary: {
          sourceLength: content.length,
          length,
          style,
          content: result.object.summary,
          mainPoints: result.object.mainPoints,
          keyTakeaways: result.object.keyTakeaways,
        },
      };
    } catch (error) {
      console.error("[Tool] summarize error:", error);
      return {
        success: false,
        error: "生成摘要失败",
        summary: null,
      };
    }
  },
});
```

**Step 2: 验证类型检查**

Run: `bun run typecheck`
Expected: 无错误

**Step 3: Commit**

```bash
git add lib/ai/tools/learning/enhance.ts
git commit -m "fix(ai): implement real LLM-based mindMap and summarize tools

- Use generateObject with proper schemas
- Remove mock data
- Add error handling

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 5: 添加 Notes 工具 userId 权限验证

**Files:**
- Modify: `lib/ai/tools/chat/notes.ts`

**Step 1: 转换为 factory 模式，绑定 userId**

```typescript
/**
 * Chat Tools - 笔记 CRUD (带权限验证)
 */

import { tool } from "ai";
import { z } from "zod";
import { and, db, documents, eq } from "@/db";

export const CreateNoteSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().default(""),
});

export type CreateNoteInput = z.infer<typeof CreateNoteSchema>;

export const GetNoteSchema = z.object({
  noteId: z.string().uuid(),
});

export const UpdateNoteSchema = z.object({
  noteId: z.string().uuid(),
  title: z.string().min(1).max(200).optional(),
  content: z.string().optional(),
});

export const DeleteNoteSchema = z.object({
  noteId: z.string().uuid(),
});

/**
 * 创建笔记工具集（绑定 userId）
 */
export function createNoteTools(userId: string) {
  return {
    createNote: tool({
      description: "创建新笔记",
      inputSchema: CreateNoteSchema,
      execute: async (args) => {
        try {
          const [note] = await db
            .insert(documents)
            .values({
              title: args.title,
              plainText: args.content,
              authorId: userId, // 绑定创建者
            })
            .returning();

          return {
            success: true,
            id: note.id,
            title: note.title,
          };
        } catch (error) {
          console.error("[Tool] createNote error:", error);
          return { success: false, error: "创建笔记失败" };
        }
      },
    }),

    getNote: tool({
      description: "获取笔记详情",
      inputSchema: GetNoteSchema,
      execute: async (args) => {
        try {
          // 验证所有权
          const note = await db.query.documents.findFirst({
            where: and(eq(documents.id, args.noteId), eq(documents.authorId, userId)),
          });

          if (!note) {
            return { success: false, error: "笔记不存在或无权访问" };
          }

          return {
            success: true,
            id: note.id,
            title: note.title,
            content: note.plainText,
            updatedAt: note.updatedAt,
          };
        } catch (error) {
          console.error("[Tool] getNote error:", error);
          return { success: false, error: "获取笔记失败" };
        }
      },
    }),

    updateNote: tool({
      description: "更新笔记",
      inputSchema: UpdateNoteSchema,
      execute: async (args) => {
        try {
          // 验证所有权
          const existing = await db.query.documents.findFirst({
            where: and(eq(documents.id, args.noteId), eq(documents.authorId, userId)),
          });

          if (!existing) {
            return { success: false, error: "笔记不存在或无权修改" };
          }

          await db
            .update(documents)
            .set({
              ...(args.title && { title: args.title }),
              ...(args.content && { plainText: args.content }),
              updatedAt: new Date(),
            })
            .where(eq(documents.id, args.noteId));

          return { success: true, id: args.noteId };
        } catch (error) {
          console.error("[Tool] updateNote error:", error);
          return { success: false, error: "更新笔记失败" };
        }
      },
    }),

    deleteNote: tool({
      description: "删除笔记",
      inputSchema: DeleteNoteSchema,
      execute: async (args) => {
        try {
          // 验证所有权
          const existing = await db.query.documents.findFirst({
            where: and(eq(documents.id, args.noteId), eq(documents.authorId, userId)),
          });

          if (!existing) {
            return { success: false, error: "笔记不存在或无权删除" };
          }

          await db.delete(documents).where(eq(documents.id, args.noteId));
          return { success: true, id: args.noteId };
        } catch (error) {
          console.error("[Tool] deleteNote error:", error);
          return { success: false, error: "删除笔记失败" };
        }
      },
    }),
  };
}

// 向后兼容的导出（标记 deprecated）
export const createNoteTool = tool({
  description: "[DEPRECATED] Use createNoteTools(userId) instead",
  inputSchema: CreateNoteSchema,
  execute: async () => ({
    success: false,
    error: "Tool requires userId context",
  }),
});

export const getNoteTool = tool({
  description: "[DEPRECATED] Use createNoteTools(userId) instead",
  inputSchema: GetNoteSchema,
  execute: async () => ({
    success: false,
    error: "Tool requires userId context",
  }),
});

export const updateNoteTool = tool({
  description: "[DEPRECATED] Use createNoteTools(userId) instead",
  inputSchema: UpdateNoteSchema,
  execute: async () => ({
    success: false,
    error: "Tool requires userId context",
  }),
});

export const deleteNoteTool = tool({
  description: "[DEPRECATED] Use createNoteTools(userId) instead",
  inputSchema: DeleteNoteSchema,
  execute: async () => ({
    success: false,
    error: "Tool requires userId context",
  }),
});
```

**Step 2: 更新 CHAT Agent 使用 factory**

修改 `lib/ai/agents/chat.ts`:

```typescript
// 在文件顶部添加 import
import { createNoteTools } from "../tools/chat/notes";

// 修改 PersonalizationOptions 添加 userId
export interface PersonalizationOptions {
  personaPrompt?: string;
  userContext?: string;
  userId?: string;
}

// 修改 createChatAgent 函数
export function createChatAgent(options?: PersonalizationOptions) {
  // ... instructions 拼接逻辑不变 ...

  // 构建工具集
  const chatTools = {
    // 如果有 userId，使用带权限验证的工具
    ...(options?.userId ? createNoteTools(options.userId) : {
      createNote: createNoteTool,
      getNote: getNoteTool,
      updateNote: updateNoteTool,
      deleteNote: deleteNoteTool,
    }),
    // 其他工具不变
    searchNotes: searchNotesTool,
    hybridSearch: hybridSearchTool,
    webSearch: webSearchTool,
    mindMap: mindMapTool,
    summarize: summarizeTool,
    editDocument: editDocumentTool,
    batchEdit: batchEditTool,
    draftContent: draftContentTool,
  } as ToolSet;

  // ... return 语句不变 ...
}
```

**Step 3: 验证类型检查**

Run: `bun run typecheck`
Expected: 无错误

**Step 4: Commit**

```bash
git add lib/ai/tools/chat/notes.ts lib/ai/agents/chat.ts
git commit -m "fix(ai): add userId permission validation to notes tools

- Convert to factory pattern with createNoteTools(userId)
- Verify ownership for get/update/delete operations
- Bind authorId on create
- Deprecate old tool exports

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 6: 验证和清理

**Files:**
- 全局

**Step 1: 运行类型检查**

Run: `bun run typecheck`
Expected: 无错误

**Step 2: 运行构建**

Run: `bun run build`
Expected: 构建成功

**Step 3: 运行 lint**

Run: `bun run lint --write`
Expected: 修复可自动修复的问题

**Step 4: Final Commit（如果有自动修复）**

```bash
git add -A
git commit -m "style: auto-fix lint issues

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Summary

| Task | 描述 | 优先级 |
|------|------|--------|
| 1 | 修复 suggestOptions 缺少 execute | Critical |
| 2 | 修复 discoverSkillsTool 调用方式 | Critical |
| 3 | 修复 webSearchTool 返回假数据 | Critical |
| 4 | 修复 mindMap/summarize 返回假数据 | Critical |
| 5 | 添加 Notes 工具 userId 权限验证 | Important |
| 6 | 验证和清理 | - |

**预期结果：**
- 所有 Tools 都有完整的 execute 实现
- 服务端代码不再通过 HTTP 调用自己的 API
- 用户数据操作都有权限验证
- 假数据替换为真实 LLM 调用或明确错误
