# AI Architecture Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** 重构 `lib/ai/` 模块，拆分 Agent 定义，统一 Personalization 服务

**Architecture:** 将 `agents/index.ts` 拆分为独立文件，创建 `personalization.ts` 合并个人化逻辑，保持 Tools 目录结构基本不变

**Tech Stack:** Next.js 16, AI SDK v6, Drizzle ORM, TypeScript

---

## Task 1: 创建 Personalization 服务

**Files:**
- Create: `lib/ai/personalization.ts`

**Step 1: 创建 lib/ai/personalization.ts**

```typescript
/**
 * Personalization Service
 *
 * 统一的个人化服务，合并 persona + user context
 */

import { buildChatContext } from "@/lib/memory/chat-context-builder";
import { getPersona, getUserPersonaPreference } from "./personas/service";

export interface PersonalizationResult {
  systemPrompt: string;
  userContext: string;
}

/**
 * 构建个人化提示
 *
 * @param userId - 用户 ID
 * @param options - 可选配置
 * @returns 个人化系统提示和用户上下文
 */
export async function buildPersonalization(
  userId: string,
  options?: {
    personaSlug?: string;
  },
): Promise<PersonalizationResult> {
  if (!userId || userId === "anonymous") {
    return { systemPrompt: "", userContext: "" };
  }

  const [persona, context] = await Promise.all([
    getExplicitOrDefaultPersona(userId, options?.personaSlug),
    buildChatContext(userId),
  ]);

  const systemPrompt = persona
    ? `\n=== AI Persona ===\n${persona.name}\n${persona.systemPrompt}\n`
    : "";

  return {
    systemPrompt,
    userContext: context || "",
  };
}

/**
 * 获取显式指定的 persona 或用户默认 persona
 */
async function getExplicitOrDefaultPersona(
  userId: string,
  explicitPersonaSlug?: string,
) {
  if (explicitPersonaSlug) {
    return getPersona(explicitPersonaSlug);
  }
  const pref = await getUserPersonaPreference(userId);
  return getPersona(pref.defaultPersonaSlug);
}
```

**Step 2: 验证类型检查**

Run: `bun run typecheck`
Expected: 无错误（新文件尚未被引用）

**Step 3: Commit**

```bash
git add lib/ai/personalization.ts
git commit -m "feat(ai): add unified personalization service

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 2: 拆分 CHAT Agent

**Files:**
- Create: `lib/ai/agents/chat.ts`
- Modify: `lib/ai/agents/index.ts`

**Step 1: 创建 lib/ai/agents/chat.ts**

```typescript
/**
 * CHAT Agent - 通用对话
 */

import { hasToolCall, stepCountIs, ToolLoopAgent, type ToolSet } from "ai";
import { aiProvider } from "../core";
import {
  createNoteTool,
  deleteNoteTool,
  getNoteTool,
  searchNotesTool,
  updateNoteTool,
  webSearchTool,
} from "../tools/chat";
import { batchEditTool, draftContentTool, editDocumentTool } from "../tools/editor";
import { mindMapTool, summarizeTool } from "../tools/learning";
import { hybridSearchTool } from "../tools/rag";

const INSTRUCTIONS = {
  chat: `你是 NexusNote 智能助手。

核心能力：
- 搜索和管理用户的笔记 (使用 searchNotes、hybridSearch、getNote)
- 创建/编辑/删除笔记 (使用 createNote、updateNote、deleteNote)
- 文档编辑 (使用 editDocument、batchEdit、draftContent)
- 生成思维导图 (使用 mindMap)
- 生成摘要 (使用 summarize)
- 互联网搜索 (使用 webSearch)

行为准则：
- 主动、简洁、有益
- 需要用户确认的操作（如删除）必须先询问
- 使用工具获取信息，不要编造`,
} as const;

// Chat Tools - 轻量级，专注通用对话
const chatTools = {
  // Notes CRUD
  createNote: createNoteTool,
  getNote: getNoteTool,
  updateNote: updateNoteTool,
  deleteNote: deleteNoteTool,
  // Search
  searchNotes: searchNotesTool,
  hybridSearch: hybridSearchTool,
  webSearch: webSearchTool,
  // Learning
  mindMap: mindMapTool,
  summarize: summarizeTool,
  // Editor
  editDocument: editDocumentTool,
  batchEdit: batchEditTool,
  draftContent: draftContentTool,
} as ToolSet;

export interface PersonalizationOptions {
  personaPrompt?: string;
  userContext?: string;
}

/**
 * 创建 CHAT Agent
 */
export function createChatAgent(options?: PersonalizationOptions) {
  const additionalInstructions = options
    ? [options.personaPrompt || "", options.userContext || ""]
        .filter((s) => s)
        .join("\n")
    : undefined;

  const fullInstructions = additionalInstructions
    ? `${additionalInstructions}\n\n${INSTRUCTIONS.chat}`
    : INSTRUCTIONS.chat;

  return new ToolLoopAgent({
    id: "nexusnote-chat",
    model: aiProvider.chatModel,
    instructions: fullInstructions,
    tools: chatTools,
    stopWhen: stepCountIs(20),
  });
}

// 导出 tools 供其他 agent 复用
export { chatTools };
```

**Step 2: 验证类型检查**

Run: `bun run typecheck`
Expected: 无错误（文件尚未被引用）

**Step 3: Commit**

```bash
git add lib/ai/agents/chat.ts
git commit -m "feat(ai): extract CHAT agent to separate file

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 3: 拆分 INTERVIEW Agent

**Files:**
- Create: `lib/ai/agents/interview.ts`

**Step 1: 创建 lib/ai/agents/interview.ts**

```typescript
/**
 * INTERVIEW Agent - 课程访谈
 */

import { stepCountIs, ToolLoopAgent } from "ai";
import { aiProvider } from "../core";
import { createInterviewTools } from "../tools/interview";

const INTERVIEW_MAX_STEPS = 12;

const INSTRUCTIONS = {
  interview: `你是 NexusNote 的课程规划师。

## 核心任务
通过自然对话了解用户的学习需求，根据复杂度自适应调整访谈深度，最后生成课程大纲。

## 重要：课程 ID 已在上下文中
系统已经为你创建了课程（course），在对话上下文的 "=== Interview Context ===" 部分可以找到 Course Profile ID。
**不要调用 createCourseProfile，直接使用上下文中提供的 ID。**

## 工作流程

### 首轮：评估复杂度（必须）
用户说想学 X 时：
1. 从上下文获取 Course Profile ID
2. **调用 assessComplexity** 评估复杂度，参数：
   - courseProfileId: 上下文中的 ID
   - topic: 用户想学的主题
   - complexity: 你的评估（trivial/simple/moderate/complex/expert）
   - estimatedTurns: 预计访谈轮数
   - reasoning: 评估理由

复杂度标准：
- **trivial** (0轮): 单一技能、无前置、几分钟可会，如"炒西红柿"
- **simple** (1轮): 少量步骤、基础工具，如"做PPT"
- **moderate** (2-3轮): 需要基础、多步骤，如"Python入门"
- **complex** (4-5轮): 需要系统学习、有前置，如"考研数学"
- **expert** (5-6轮): 深度领域、长期投入，如"机器学习"

3. 如果 assessComplexity 返回 skipInterview=true（trivial），直接调用 confirmOutline
4. 否则调用 suggestOptions 提供选项，继续访谈

### 每轮：收集信息
1. 调用 updateProfile 更新画像（background, currentLevel, targetOutcome 等）
2. 调用 suggestOptions 提供 3-4 个选项
3. 文字回应 + 继续提问

### 完成：生成大纲
当达到预计轮数或用户满意时：
1. 调用 confirmOutline 生成最终大纲
2. 告知用户可以开始学习

## 行为准则
- 主动、简洁、自然
- 像朋友聊天，不审问
- 每次回复都要有文字
- 每轮都要调用 suggestOptions 提供选项
- **首轮必须调用 assessComplexity**
- **只在访谈结束时调用 confirmOutline**`,
} as const;

export interface InterviewOptions {
  courseProfileId: string;
}

/**
 * 创建 INTERVIEW Agent
 */
export function createInterviewAgent(options: InterviewOptions) {
  if (!options.courseProfileId) {
    throw new Error("INTERVIEW agent requires courseProfileId");
  }

  const interviewTools = createInterviewTools(options.courseProfileId);

  return new ToolLoopAgent({
    id: "nexusnote-interview",
    model: aiProvider.proModel,
    instructions: INSTRUCTIONS.interview,
    tools: interviewTools,
    stopWhen: stepCountIs(INTERVIEW_MAX_STEPS),
  });
}
```

**Step 2: 验证类型检查**

Run: `bun run typecheck`
Expected: 无错误

**Step 3: Commit**

```bash
git add lib/ai/agents/interview.ts
git commit -m "feat(ai): extract INTERVIEW agent to separate file

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 4: 拆分 COURSE Agent

**Files:**
- Create: `lib/ai/agents/course.ts`

**Step 1: 创建 lib/ai/agents/course.ts**

```typescript
/**
 * COURSE Agent - 课程内容生成
 */

import { stepCountIs, ToolLoopAgent, type ToolSet } from "ai";
import { aiProvider } from "../core";
import { chatTools, createChatAgent, type PersonalizationOptions } from "./chat";
import { generateCourseTool, checkCourseProgressTool } from "../tools/learning";

const INSTRUCTIONS = {
  course: `你是课程内容生成助手。

根据用户提供的大纲主题，生成详细的课程内容。`,
} as const;

// Course Tools = Chat Tools + Course-specific tools
const courseTools = {
  ...chatTools,
  generateCourse: generateCourseTool,
  checkCourseProgress: checkCourseProgressTool,
} as ToolSet;

/**
 * 创建 COURSE Agent
 */
export function createCourseAgent(options?: PersonalizationOptions) {
  const additionalInstructions = options
    ? [options.personaPrompt || "", options.userContext || ""]
        .filter((s) => s)
        .join("\n")
    : undefined;

  const fullInstructions = additionalInstructions
    ? `${additionalInstructions}\n\n${INSTRUCTIONS.course}`
    : INSTRUCTIONS.course;

  return new ToolLoopAgent({
    id: "nexusnote-course",
    model: aiProvider.proModel,
    instructions: fullInstructions,
    tools: courseTools,
    stopWhen: stepCountIs(20),
  });
}
```

**Step 2: 验证类型检查**

Run: `bun run typecheck`
Expected: 无错误

**Step 3: Commit**

```bash
git add lib/ai/agents/course.ts
git commit -m "feat(ai): extract COURSE agent to separate file

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 5: 拆分 SKILLS Agent

**Files:**
- Create: `lib/ai/agents/skills.ts`

**Step 1: 创建 lib/ai/agents/skills.ts**

```typescript
/**
 * SKILLS Agent - 技能发现
 */

import { stepCountIs, ToolLoopAgent, type ToolSet } from "ai";
import { aiProvider } from "../core";
import type { PersonalizationOptions } from "./chat";
import { discoverSkillsTool } from "../tools/skills";

const INSTRUCTIONS = {
  skills: `你是 NexusNote 的技能发现专家。

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

使用 discoverSkills 工具来发现并保存技能。`,
} as const;

const skillsTools = {
  discoverSkills: discoverSkillsTool,
} as ToolSet;

/**
 * 创建 SKILLS Agent
 */
export function createSkillsAgent(options?: PersonalizationOptions) {
  const additionalInstructions = options
    ? [options.personaPrompt || "", options.userContext || ""]
        .filter((s) => s)
        .join("\n")
    : undefined;

  const fullInstructions = additionalInstructions
    ? `${additionalInstructions}\n\n${INSTRUCTIONS.skills}`
    : INSTRUCTIONS.skills;

  return new ToolLoopAgent({
    id: "nexusnote-skills",
    model: aiProvider.proModel,
    instructions: fullInstructions,
    tools: skillsTools,
    stopWhen: stepCountIs(20),
  });
}
```

**Step 2: 验证类型检查**

Run: `bun run typecheck`
Expected: 无错误

**Step 3: Commit**

```bash
git add lib/ai/agents/skills.ts
git commit -m "feat(ai): extract SKILLS agent to separate file

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 6: 重构 agents/index.ts 为 Factory

**Files:**
- Modify: `lib/ai/agents/index.ts`

**Step 1: 重写 lib/ai/agents/index.ts**

```typescript
/**
 * AI Agents - Factory
 *
 * 统一的 Agent 创建入口
 */

import type { ToolLoopAgent } from "ai";
import { createChatAgent, type PersonalizationOptions } from "./chat";
import { createInterviewAgent, type InterviewOptions } from "./interview";
import { createCourseAgent } from "./course";
import { createSkillsAgent } from "./skills";

// ============================================
// Types
// ============================================

export type AgentIntent = "CHAT" | "INTERVIEW" | "COURSE" | "SKILLS";

export type { PersonalizationOptions, InterviewOptions };

// ============================================
// Factory
// ============================================

/**
 * 获取 Agent 实例
 *
 * @param intent - Agent 类型
 * @param options - Agent 配置
 */
export function getAgent(
  intent: AgentIntent,
  options?: PersonalizationOptions | InterviewOptions,
): ToolLoopAgent {
  switch (intent) {
    case "INTERVIEW": {
      return createInterviewAgent(options as InterviewOptions);
    }
    case "COURSE":
      return createCourseAgent(options as PersonalizationOptions | undefined);
    case "SKILLS":
      return createSkillsAgent(options as PersonalizationOptions | undefined);
    default:
      return createChatAgent(options as PersonalizationOptions | undefined);
  }
}
```

**Step 2: 验证类型检查**

Run: `bun run typecheck`
Expected: 无错误

**Step 3: Commit**

```bash
git add lib/ai/agents/index.ts
git commit -m "refactor(ai): simplify agents/index.ts to factory pattern

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 7: 更新 chat/route.ts 使用 Personalization

**Files:**
- Modify: `app/api/chat/route.ts`

**Step 1: 更新 import 并使用 buildPersonalization**

找到 `app/api/chat/route.ts` 中的第 14 行和第 17 行，修改为：

```typescript
// 删除
import { getPersona, getUserPersonaPreference } from "@/lib/ai/personas";
import { buildChatContext } from "@/lib/memory/chat-context-builder";

// 替换为
import { buildPersonalization } from "@/lib/ai/personalization";
```

**Step 2: 替换 getExplicitOrDefaultPersona 和 buildChatContext 调用**

找到第 29-39 行的 `getExplicitOrDefaultPersona` 函数，删除它。

找到第 140-154 行的 personalization 加载逻辑：

```typescript
// 旧代码（删除）
if (userId && userId !== "anonymous") {
  const [persona, context] = await Promise.all([
    getExplicitOrDefaultPersona(userId, personaSlug),
    buildChatContext(userId),
  ]);

  if (persona) {
    console.log("[Chat] Persona loaded:", persona.name, persona.slug);
    personaSystemPrompt = `\n=== AI Persona ===\n${persona.name}\n${persona.systemPrompt}\n`;
  }

  if (context) {
    userContext = `\n${context}\n`;
  }
}
```

替换为：

```typescript
// 新代码
if (userId && userId !== "anonymous") {
  const { systemPrompt, userContext: context } = await buildPersonalization(userId, {
    personaSlug,
  });
  personaSystemPrompt = systemPrompt;
  userContext = context;
}
```

**Step 3: 验证类型检查**

Run: `bun run typecheck`
Expected: 无错误

**Step 4: Commit**

```bash
git add app/api/chat/route.ts
git commit -m "refactor(api): use unified buildPersonalization in chat route

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 8: 更新 lib/ai/index.ts 导出

**Files:**
- Modify: `lib/ai/index.ts`

**Step 1: 添加 personalization 导出**

```typescript
/**
 * AI Module - Tools, Agents, Validation, Core, Personalization
 */

// Agents
export { getAgent } from "./agents";
export type { AgentIntent, PersonalizationOptions, InterviewOptions } from "./agents";
// Core AI (aiProvider only)
export { aiProvider } from "./core";
// Personalization
export { buildPersonalization } from "./personalization";
export type { PersonalizationResult } from "./personalization";
// Tools
export * from "./tools";
export type { ChatRequest, Intent } from "./validation";
// Validation
export { ChatRequestSchema, validateRequest } from "./validation";
```

**Step 2: 验证类型检查**

Run: `bun run typecheck`
Expected: 无错误

**Step 3: Commit**

```bash
git add lib/ai/index.ts
git commit -m "feat(ai): export buildPersonalization from ai module

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 9: 验证和清理

**Files:**
- 全局

**Step 1: 运行类型检查**

Run: `bun run typecheck`
Expected: 无错误

**Step 2: 运行构建**

Run: `bun run build`
Expected: 构建成功

**Step 3: 运行 lint**

Run: `bun run lint`
Expected: 无错误

**Step 4: Final Commit（如果有自动修复）**

```bash
git add -A
git commit -m "style: auto-fix lint issues

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Summary

| Task | 描述 | 文件数 |
|------|------|--------|
| 1 | 创建 Personalization 服务 | +1 |
| 2 | 拆分 CHAT Agent | +1 |
| 3 | 拆分 INTERVIEW Agent | +1 |
| 4 | 拆分 COURSE Agent | +1 |
| 5 | 拆分 SKILLS Agent | +1 |
| 6 | 重构 agents/index.ts | ~1 |
| 7 | 更新 chat/route.ts | ~1 |
| 8 | 更新 lib/ai/index.ts | ~1 |
| 9 | 验证和清理 | - |

**预期结果：**
- `lib/ai/agents/` 从 1 个 242 行文件变为 5 个模块化文件
- `lib/ai/personalization.ts` 提供统一的个人化服务
- API routes 使用简化的 `buildPersonalization()` 调用
