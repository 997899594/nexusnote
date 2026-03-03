# AI 架构重构设计文档

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** 重构 `lib/ai/` 模块，简化架构，提升可维护性和扩展性

**Date:** 2026-03-03

---

## 1. 当前问题

| 问题 | 现状 | 影响 |
|------|------|------|
| Agent 分散 | 定义在 `agents/index.ts` 单文件，300+ 行 | 难以维护 |
| Tools 混乱 | 按"功能"组织，与 Agent 无关 | 找不到工具归属 |
| Personalization 分散 | persona、emotion、context 在多处调用 | 重复代码 |
| API Routes 冗余 | 5 个 route，部分可合并 | 维护成本高 |
| 死代码 | intent-router、未使用的 safeGenerateObject 调用 | 代码噪音 |

---

## 2. 目标架构

### 2.1 目录结构

```
lib/ai/
├── index.ts              # 统一导出
├── core.ts               # AIProvider 单例（保持现状，104 行）
├── agents/
│   ├── index.ts          # getAgent() factory + 类型导出
│   ├── chat.ts           # CHAT agent 定义
│   ├── interview.ts      # INTERVIEW agent 定义
│   ├── course.ts         # COURSE agent 定义
│   └── skills.ts         # SKILLS agent 定义
├── tools/
│   ├── chat/             # CHAT agent 专用工具
│   │   ├── index.ts
│   │   ├── create-flashcard.ts
│   │   ├── search-knowledge.ts
│   │   ├── create-note.ts
│   │   └── web-search.ts
│   ├── interview/        # INTERVIEW agent 专用工具（factory 模式）
│   │   ├── index.ts
│   │   └── ... (现有)
│   ├── course/           # COURSE agent 专用工具
│   │   ├── index.ts
│   │   └── generate-content.ts
│   ├── skills/           # SKILLS agent 专用工具
│   │   ├── index.ts
│   │   └── discover-skills.ts
│   └── rag/              # 共享 RAG 工具
│       └── index.ts
├── personalization.ts    # 统一个人化服务
└── validation.ts         # 请求验证 schema（保持现状）
```

### 2.2 Agent 设计

**4 个独立 Agent：**

| Agent | 用途 | Model | Temperature |
|-------|------|-------|-------------|
| CHAT | 通用对话 | Flash | 0.7 |
| INTERVIEW | 课程访谈 | Flash | 0.2 |
| COURSE | 课程内容生成 | Pro | 0.3 |
| SKILLS | 技能发现 | Pro | 0.3 |

**Agent 定义拆分：**

```typescript
// lib/ai/agents/chat.ts
export const chatAgent = new ToolLoopAgent({
  id: "nexusnote-chat",
  model: aiProvider.chatModel,
  instructions: INSTRUCTIONS.chat,
  tools: chatTools,
  stopWhen: stepCountIs(20),
});

// lib/ai/agents/index.ts
export function getAgent(
  intent: AgentIntent,
  options?: PersonalizationOptions
): ToolLoopAgent {
  switch (intent) {
    case "CHAT":
      return chatAgent;
    case "INTERVIEW":
      return createInterviewAgent(options);
    case "COURSE":
      return courseAgent;
    case "SKILLS":
      return skillsAgent;
    default:
      return chatAgent;
  }
}
```

### 2.3 Tools 组织原则

1. **按 Agent 场景组织** - 每个 Agent 有独立的 tools 目录
2. **RAG 工具共享** - `lib/ai/tools/rag/` 被多个 Agent 引用
3. **Factory 模式** - 需要绑定上下文的工具使用工厂函数（如 interview）

### 2.4 Personalization 服务

**合并为一个函数：**

```typescript
// lib/ai/personalization.ts
export async function buildPersonalization(
  userId: string,
  options?: { personaSlug?: string }
): Promise<{
  systemPrompt: string;
  userContext: string;
}> {
  if (!userId || userId === "anonymous") {
    return { systemPrompt: "", userContext: "" };
  }

  const [persona, context] = await Promise.all([
    getPersonaOrDefault(userId, options?.personaSlug),
    buildChatContext(userId),
  ]);

  const systemPrompt = persona
    ? `\n=== AI Persona ===\n${persona.name}\n${persona.systemPrompt}\n`
    : "";

  return { systemPrompt, userContext: context || "" };
}
```

**删除/合并：**
- `lib/memory/chat-context-builder.ts` → 合并到 `personalization.ts`

### 2.5 API Routes 简化

**重构后 3 个 Routes：**

| Route | 用途 |
|-------|------|
| `/api/chat` | 通用入口，通过 `intent` 参数路由 |
| `/api/learn/[id]/content` | 课程内容生成（Server Action 更合适，暂时保留） |
| `/api/editor/ai` | 编辑器 AI（独立场景，保留） |

**合并：**
- `/api/interview` → `/api/chat?intent=INTERVIEW`
- `/api/skills/discover` → `/api/chat?intent=SKILLS`

---

## 3. 实施任务

### Task 1: 创建新的目录结构

**操作：**
- 创建 `lib/ai/agents/` 目录（已存在）
- 创建 `lib/ai/tools/chat/`、`lib/ai/tools/course/`、`lib/ai/tools/skills/` 目录
- 确认 `lib/ai/tools/interview/` 和 `lib/ai/tools/rag/` 已存在

### Task 2: 拆分 Agent 定义

**文件：** `lib/ai/agents/index.ts`

**操作：**
1. 提取 CHAT agent 定义到 `lib/ai/agents/chat.ts`
2. 提取 INTERVIEW agent 定义到 `lib/ai/agents/interview.ts`
3. 提取 COURSE agent 定义到 `lib/ai/agents/course.ts`
4. 新建 SKILLS agent 定义到 `lib/ai/agents/skills.ts`
5. 简化 `lib/ai/agents/index.ts` 只保留 `getAgent()` 和类型导出

### Task 3: 重组 Tools

**操作：**
1. 将 `lib/ai/tools/chat.ts` 重构为 `lib/ai/tools/chat/index.ts`
2. 创建 `lib/ai/tools/course/index.ts` 导出 course tools
3. 创建 `lib/ai/tools/skills/index.ts` 导出 skills tools
4. 确认 `lib/ai/tools/interview/index.ts` 已是 factory 模式

### Task 4: 创建 Personalization 服务

**新建文件：** `lib/ai/personalization.ts`

**操作：**
1. 创建 `buildPersonalization()` 函数
2. 合并 `lib/memory/chat-context-builder.ts` 逻辑
3. 更新调用方使用新函数

### Task 5: 简化 API Routes

**操作：**
1. 修改 `/api/chat/route.ts` 支持 `intent` 参数
2. 删除 `/api/interview/route.ts`（功能合并到 chat）
3. 修改 `/api/skills/discover/route.ts` 调用 SKILLS agent
4. 更新相关导入

### Task 6: 更新导出和类型

**文件：** `lib/ai/index.ts`

**操作：**
1. 更新导出路径
2. 确保所有公共 API 从 `lib/ai/index.ts` 导出

### Task 7: 验证

**命令：**
```bash
bun run typecheck
bun run build
bun run lint
```

---

## 4. 删除清单

| 类别 | 项目 | 文件/位置 |
|------|------|-----------|
| 文件 | intent-router | `lib/ai/agents/index.ts` 内部逻辑 |
| 目录 | `/api/interview/` | `app/api/interview/route.ts` |

---

## 5. 风险评估

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| Agent 拆分后导入路径变化 | 中 | 更新所有 import 语句 |
| API 合并后客户端调用变化 | 高 | 保持向后兼容，支持 `intent` 参数 |
| Personalization 合并 | 低 | 函数签名保持简单 |

---

## 6. 预期收益

- **代码量减少**: ~200 行（删除重复代码）
- **可维护性提升**: Agent 和 Tools 一一对应
- **扩展性提升**: 新增 Agent 只需新建文件
- **性能无变化**: 运行时行为不变
