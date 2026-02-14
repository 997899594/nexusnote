# Interview Agent 重构方案

> 日期：2026-02-13
> 状态：待实施
> 优先级：高 — 影响核心用户流程

## 问题概述

`/create?goal=xxx` 页面的 interview 流程存在根本性设计错误：AI 一口气问完四个问题并生成大纲，用户全程无法参与对话。

**根因：把 human-in-the-loop 场景误写成了 autonomous agent 模式。**

---

## 一、当前架构的具体问题

### 问题 1：`presentOptions` 不应该有 `execute` 函数

**文件**：`features/learning/tools/interview.ts:22-44`

```typescript
// ❌ 当前写法 — agent 认为工具已自主完成，继续循环
export const presentOptionsTool = tool({
  inputSchema: z.object({ ... }),
  execute: async () => ({ status: "ui_rendered" }),
});
```

AI SDK v6 的规则：
- **有 `execute`** → 服务端自动执行，agent 循环继续
- **没有 `execute`** → agent 循环自动停止，等待客户端通过 `addToolOutput` 返回结果

`presentOptions` 是交互型工具（需要用户点选项），不应该有 `execute`。给了 `execute` 等于告诉 ToolLoopAgent"不需要人参与"。

### 问题 2：`prepareCall` vs `prepareStep` 用混了

**文件**：`features/learning/agents/interview/agent.ts:67-146`

| 钩子 | 调用时机 | 适合的逻辑 |
|------|---------|-----------|
| `prepareCall` | 每次请求调用**一次** | 请求级配置：注入用户信息、RAG、选模型 |
| `prepareStep` | 循环内**每步**都调用 | 步级控制：根据步数切换 toolChoice、动态工具 |

当前所有 phase 检测、`toolChoice` 强制、`stopWhen` 全在 `prepareCall` 里——只执行一次，无法在循环内动态调整。

### 问题 3：状态管理三源头

当前状态流经三个地方：

```
客户端 useReducer (context)
    ↓ 手动复制到
sendMessage body (interviewContext)
    ↓ 手动复制到
服务端 prepareCall options
```

每次用户选择后要手动 dispatch + 构造 body + 服务端解析——三份拷贝容易不同步。

AI SDK v6 的理念：**`UIMessage[]` 是唯一状态源**。工具输入输出自然记录在消息历史中，服务端从历史重建状态。

### 问题 4：`stopWhen: stepCountIs(1)` 是临时补丁

**文件**：`features/learning/agents/interview/agent.ts:126-145`

2026-02-13 加的 `stopWhen: stepCountIs(1)` 能解决症状（AI 不会一口气跑完），但本质是绕过问题——正确的做法是让工具本身就能停止循环。

---

## 二、正确的 2026 架构

### 核心原则

| 概念 | 说明 |
|------|------|
| **Client-side Tool** | 没有 `execute` 的工具 → agent 循环自动暂停 |
| **`addToolOutput`** | 客户端提供工具结果 → 自动触发下一轮请求 |
| **`sendAutomaticallyWhen`** | 当所有工具都有输出时自动发送 |
| **消息历史即状态** | 不需要 side-channel 传递 context |

### 改造后的数据流

```
用户输入 "你是谁"
  → sendMessage({ text: "你是谁" })
  → 服务端 agent.stream()
  → AI 输出文字 + 调用 presentOptions（无 execute → 循环自动停止）
  → 客户端 useChat 收到 tool part，state = "input-available"
  → UI 渲染选项按钮
  → 用户点击 "Web开发"
  → addToolOutput({ tool: "presentOptions", toolCallId, output: '{"selected":"Web开发"}' })
  → sendAutomaticallyWhen 触发 → 自动发起下一轮请求
  → 服务端从消息历史提取已收集信息 → AI 问下一个问题
  → ...重复直到四个维度收集完毕
  → AI 调用 generateOutline（有 execute → 服务端执行，返回大纲）
  → 客户端收到大纲 → 进入 outline_review phase
```

---

## 三、改造步骤

### Step 1：改造 `presentOptions` 为 client-side tool

**文件**：`features/learning/tools/interview.ts`

```typescript
// ✅ 正确写法 — 没有 execute，agent 循环自动暂停等待用户
export const presentOptionsTool = tool({
  description: "向用户展示可点击的选项卡片，等待用户选择",
  inputSchema: z.object({
    replyToUser: z.string().describe("对用户说的话"),
    question: z.string().describe("卡片标题，5-10个字"),
    options: z.array(z.string()).min(2).max(4).describe("选项列表"),
    targetField: z
      .enum(["goal", "background", "targetOutcome", "cognitiveStyle", "general"])
      .describe("问题类型"),
    allowSkip: z.boolean().optional(),
    multiSelect: z.boolean().optional(),
  }),
  // 没有 execute → 自动变成 client-side tool
});
```

`generateOutline` 保留 `execute`（不需要用户交互，服务端自主完成）。

### Step 2：客户端用 `addToolOutput` 替代 `handleSendMessage`

**文件**：`features/learning/hooks/useCourseGeneration.ts`

```typescript
import { lastAssistantMessageIsCompleteWithToolCalls } from "ai/react";

const { messages, sendMessage, addToolOutput, status, error, stop } =
  useChat<InterviewAgentMessage>({
    // 当所有 client-side tool 都有输出时，自动发起下一轮请求
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
  });

// 用户选择选项时的处理函数
const handleOptionSelect = useCallback(
  (toolCallId: string, selectedOption: string, targetField: string) => {
    addToolOutput({
      tool: "presentOptions",
      toolCallId,
      output: JSON.stringify({ selected: selectedOption, targetField }),
    });
    // 不需要 dispatch、不需要手动 sendMessage
    // sendAutomaticallyWhen 会自动触发下一轮
  },
  [addToolOutput],
);
```

### Step 3：服务端从消息历史重建状态

**文件**：`features/learning/agents/interview/agent.ts`

```typescript
import { ToolLoopAgent } from "ai";

export const interviewAgent = new ToolLoopAgent({
  id: "nexusnote-interview",
  model: interviewModel,
  tools: interviewTools,
  maxOutputTokens: 4096,

  // prepareCall：请求级配置（只做一次）
  prepareCall: ({ messages, ...rest }) => {
    // 从消息历史中提取已收集的维度
    const context = extractContextFromMessages(messages);
    const instructions = buildInterviewPrompt(context);

    const hasAllInfo =
      Boolean(context.goal) &&
      Boolean(context.background) &&
      Boolean(context.targetOutcome) &&
      Boolean(context.cognitiveStyle);

    if (hasAllInfo) {
      return {
        ...rest,
        instructions,
        temperature: 0.7,
        toolChoice: { type: "tool", toolName: "generateOutline" },
        stopWhen: stepCountIs(1),
      };
    }

    return {
      ...rest,
      instructions,
      temperature: 0.7,
      // presentOptions 没有 execute，循环会自然停止
      // 不需要 stopWhen hack
    };
  },
});

/**
 * 从消息历史中提取用户已提供的信息
 * presentOptions 的 tool output 里包含用户的选择
 */
function extractContextFromMessages(messages: unknown[]): InterviewContext {
  const context: InterviewContext = {
    goal: "",
    background: "",
    targetOutcome: "",
    cognitiveStyle: "",
  };

  // 遍历消息，找所有 presentOptions 的 tool output
  for (const msg of messages) {
    // 根据 UIMessage 结构解析 tool parts
    // 每个 presentOptions 的 output 包含 { selected, targetField }
    // 将 selected 值写入对应的 context 字段
  }

  return context;
}
```

### Step 4：简化 ChatInterface

**文件**：`features/learning/components/create/ChatInterface.tsx`

```typescript
// 从 message parts 中找 presentOptions tool call
// 当 state === "input-available" 时渲染选项按钮
// 点击时调用 handleOptionSelect(toolCallId, option, targetField)

{lastMessage?.parts?.map((part) => {
  if (
    part.type === "tool-presentOptions" &&
    part.state === "input-available"
  ) {
    return (
      <div key={part.toolCallId} className="flex flex-wrap gap-3">
        {part.input.options.map((option) => (
          <button
            key={option}
            onClick={() => handleOptionSelect(part.toolCallId, option, part.input.targetField)}
          >
            {option}
          </button>
        ))}
      </div>
    );
  }
  return null;
})}
```

### Step 5：删除不再需要的代码

- `useCourseGeneration.ts` 中的 `useReducer` context 管理（状态改由消息历史承载）
- `handleSendMessage` 中的 `contextUpdate` / `dispatch` 逻辑
- `sendMessage` 的 `body.interviewContext` 传递
- API route 中的 `interviewContext` 解析和 options 构造
- `stopWhen: stepCountIs(1)` 临时补丁
- `processedToolCallIds` ref（SDK 自动处理去重）
- auto-resume useEffect（SDK 的 `sendAutomaticallyWhen` 替代）

---

## 四、Agent（ToolLoopAgent 自治循环）适合用在哪里

### 判断标准

| 特征 | 适合 Agent 自治循环 | 适合 Human-in-the-loop |
|------|-------------------|----------------------|
| 是否需要用户输入 | 不需要 | 需要 |
| 工具是否有副作用需确认 | 无/可逆 | 有/不可逆 |
| 任务是否可以一次性完成 | 是 | 否 |
| 错误成本 | 低 | 高 |

### 你项目中的三个 Agent 场景

#### 1. Course Generation Agent — 适合自治循环 ✅

**文件**：`features/learning/agents/course-generation/agent.ts`

```
用户确认大纲 → 后台自动生成所有章节内容 → 保存到数据库
```

- 不需要用户参与每章的生成
- `saveChapterContent` 是服务端工具，有 `execute`
- 循环直到所有章节生成完毕
- **当前实现是正确的**，`stopWhen` 检测 `saveChapterContent` 调用完成

#### 2. Chat Agent（搜索/编辑）— 适合自治循环 ✅

```
用户提问 → AI 搜索 → AI 整理答案 → 返回
用户说"修改标题" → AI 调用 editDocument → 完成
```

- 工具（searchWeb、editDocument）都是服务端自主执行
- 不需要中间确认
- `stepCountIs(3)` 合理

#### 3. Interview Agent — 不适合自治循环 ❌

```
AI 问问题 → 等用户选 → AI 问下一个 → 等用户选 → ...
```

- 每一步都需要用户输入
- 应该用 client-side tool（无 execute）
- 每次 agent 只执行到 `presentOptions` 就自动停止

### 总结：何时用 `execute`，何时不用

```
工具需要人参与？
  ├── 是 → 不写 execute（client-side tool）
  │        例：presentOptions, confirmAction, askForFeedback
  │        效果：agent 循环自动暂停，等 addToolOutput
  │
  └── 否 → 写 execute（server-side tool）
           例：generateOutline, saveChapterContent, searchWeb, editDocument
           效果：服务端自动执行，agent 循环继续
```

---

## 五、改造前后对比

### 改造前

```
sendMessage("你是谁", { body: { interviewContext: {...} } })
  → 服务端 prepareCall（一次性配置）
  → agent 循环开始
  → presentOptions.execute() → { status: "ui_rendered" }  // agent 以为搞定了
  → 继续循环 → presentOptions → presentOptions → presentOptions → generateOutline
  → 一口气全部完成，用户没有参与机会
```

### 改造后

```
sendMessage("你是谁")
  → 服务端 prepareCall
  → agent 调用 presentOptions（无 execute → 循环自动停止）
  → 客户端渲染选项，等用户点击
  → 用户点击 → addToolOutput → sendAutomaticallyWhen 触发下一轮
  → 服务端从消息历史提取已收集信息
  → agent 调用 presentOptions → 又停止 → 等用户
  → ...四轮对话后...
  → 所有信息收集完毕 → agent 调用 generateOutline（有 execute → 自动完成）
  → 客户端收到大纲 → 进入 outline_review
```

---

## 六、需要注意的点

1. **`addToolOutput` 的 output 是字符串**，需要 `JSON.stringify`
2. **`sendAutomaticallyWhen`** 需要从 `ai/react` 导入内置函数 `lastAssistantMessageIsCompleteWithToolCalls`
3. **消息历史会变长**（每轮多一对 tool call + tool output），注意 token 管理
4. **localStorage 持久化逻辑可以简化**，因为 `UIMessage[]` 自带完整状态
5. **`extractContextFromMessages` 需要处理 UIMessage 的 parts 结构**，不同于旧的 flat message

---

## 七、涉及文件清单

| 文件 | 改动 |
|------|------|
| `features/learning/tools/interview.ts` | `presentOptions` 删除 `execute` |
| `features/learning/agents/interview/agent.ts` | 重写 `prepareCall`，删除 side-channel context，加 `extractContextFromMessages` |
| `features/learning/hooks/useCourseGeneration.ts` | 用 `addToolOutput` + `sendAutomaticallyWhen` 替代手动状态管理 |
| `features/learning/components/create/ChatInterface.tsx` | 从 message parts 读 tool state，调 `handleOptionSelect` |
| `app/api/chat/route.ts` | INTERVIEW case 删除 `interviewContext` 解析，直接传 `uiMessages` |
| `features/shared/ai/prompts/interview.ts` | 无需改动（prompt 逻辑不变） |

---

## 八、多 Agent 协作架构（体验升级）

### 当前单 Agent 的真实瓶颈

访谈流程本质上是 **4 步表单**，不管交互模式怎么改，有三个靠单 agent 解决不了的问题：

| 瓶颈 | 说明 |
|------|------|
| **AI 不懂用户要学的领域** | 用户说"学 Kubernetes"，AI 靠训练数据生成泛泛选项。不知道 K8s 最新版本、Gateway API 趋势、用户可能需要先学 Docker |
| **大纲生成太粗糙** | `generateOutline` 靠 4 个字段让模型编大纲，没参考真实教材、知识图谱、学习路径 |
| **对话缺乏深度** | 四轮固定问答，每轮"说一句话+给选项"，和填表单没本质区别 |

### 设计原则：一个面子，两个里子

**用户始终只跟一个 Interview Agent 对话。** 不做角色切换，不做"现在转接课程设计师"。背后两个专业 agent 作为 server-side tool 被静默调用。

```
用户
  ↕ 对话（唯一交互面）
Interview Agent（编排者）
  ├── tool: researchTopic  → Topic Research Agent（里子 1）
  │     搜索 web、分析领域、找前置技能、返回结构化摘要
  │
  └── tool: designCurriculum → Curriculum Designer Agent（里子 2）
        拿到用户画像 + 领域研究 → 用更强模型设计专业大纲
```

### 场景对比

**现在（单 agent，无领域知识）：**

```
用户："我想学 Kubernetes"
AI："很棒！你对哪个方向感兴趣？"
  [容器编排] [微服务部署] [云原生开发] [DevOps 实践]

→ 选项来自 LLM 常识，泛泛而谈
```

**改造后（Research Agent 提供领域知识）：**

```
用户："我想学 Kubernetes"
                        ← Interview Agent 静默调用 researchTopic("Kubernetes")
                        ← Research Agent 搜索后返回：
                        ←   K8s 1.32 Gateway API 替代 Ingress
                        ←   学习路径：Docker → Pod → Service → Deployment → Helm
                        ←   前置知识：Linux 基础、网络基础、容器概念

AI："Kubernetes 最近动作挺大——1.32 版本的 Gateway API 正在替代传统 Ingress，
     生态变化不小。你现在是想从运维角度管理集群，还是作为开发者部署应用？"
  [应用开发者视角] [运维/SRE 视角] [从零学起（含 Docker 基础）] [已有基础，想进阶]

→ 选项基于真实领域知识，有深度，能动态调整
```

### 三个 Agent 的职责定义

#### 1. Interview Agent（用户面对的编排者）

| 属性 | 值 |
|------|---|
| **模型** | chatModel（对话能力优先） |
| **角色** | 温暖专业的课程导师 |
| **工具** | `presentOptions`(无execute), `researchTopic`(有execute), `designCurriculum`(有execute) |
| **职责** | 引导对话、根据研究结果调整问题、决定何时信息充分 |

关键能力：
- 根据 Research Agent 返回的领域知识，生成**有深度的选项**
- 能追问、能跳过（如果用户已经表达了足够信息）
- 不再是固定 4 步，而是**信息充分即可进入大纲设计**

#### 2. Topic Research Agent（领域研究）

| 属性 | 值 |
|------|---|
| **模型** | chatModel |
| **工具** | `searchWeb` |
| **调用方式** | Interview Agent 的 server-side tool（`researchTopic`） |
| **调用时机** | 用户首次说出学习主题时；用户选择具体方向后可能再调一次 |

输入/输出：

```typescript
// 输入
{ topic: "Kubernetes", userBackground?: "有 Docker 经验" }

// 输出（结构化）
{
  summary: "Kubernetes 是容器编排平台...",
  currentVersion: "1.32",
  recentTrends: ["Gateway API 替代 Ingress", "Sidecarless Service Mesh"],
  typicalLearningPath: ["Docker 基础", "Pod 概念", "Service/Networking", "Deployment", "Helm/Kustomize"],
  prerequisites: ["Linux 命令行", "网络基础(TCP/IP)", "容器概念"],
  commonGoals: ["部署应用到生产环境", "考 CKA 认证", "搭建 CI/CD 流水线"]
}
```

#### 3. Curriculum Designer Agent（课程设计）

| 属性 | 值 |
|------|---|
| **模型** | courseModel（更强的推理能力） |
| **工具** | 无（纯文本生成，结构化输出） |
| **调用方式** | Interview Agent 的 server-side tool（`designCurriculum`） |
| **调用时机** | 所有信息收集完毕后，替代当前的 `generateOutline` |

输入/输出：

```typescript
// 输入
{
  userProfile: { goal, background, targetOutcome, cognitiveStyle },
  domainResearch: { /* Research Agent 的输出 */ },
}

// 输出
{
  title: "Kubernetes 应用开发实战",
  description: "从 Docker 到 K8s，面向应用开发者的渐进式学习路径",
  difficulty: "intermediate",
  estimatedMinutes: 480,
  designRationale: "用户有 Docker 基础，跳过容器入门；侧重应用部署而非集群运维...",
  modules: [ /* 基于真实学习路径设计的模块 */ ],
}
```

### AI SDK v6 实现

#### 新增的 interview tools

```typescript
// features/learning/tools/interview.ts

// presentOptions — client-side tool（无 execute，等用户）
export const presentOptionsTool = tool({
  description: "展示选项卡片，等待用户选择",
  inputSchema: z.object({
    replyToUser: z.string(),
    question: z.string(),
    options: z.array(z.string()).min(2).max(4),
    targetField: z.enum(["goal", "background", "targetOutcome", "cognitiveStyle", "general"]),
  }),
  // 无 execute → agent 循环自动暂停
});

// researchTopic — server-side tool（有 execute，调用子 agent）
export const researchTopicTool = tool({
  description: "研究用户想学的领域，获取最新信息、学习路径和前置知识",
  inputSchema: z.object({
    topic: z.string().describe("用户想学的主题"),
    specificDirection: z.string().optional().describe("用户选择的具体方向"),
    userBackground: z.string().optional().describe("用户已有的背景"),
  }),
  execute: async ({ topic, specificDirection, userBackground }) => {
    const result = await researchAgent.generate({
      prompt: `研究「${topic}」${specificDirection ? `（方向：${specificDirection}）` : ""} 的学习领域。
               ${userBackground ? `用户背景：${userBackground}` : ""}
               返回：领域摘要、最新趋势、典型学习路径、前置知识、常见学习目标。`,
    });
    return result.text;
  },
});

// designCurriculum — server-side tool（有 execute，调用子 agent）
export const designCurriculumTool = tool({
  description: "基于用户画像和领域研究设计个性化课程大纲",
  inputSchema: z.object({
    goal: z.string(),
    background: z.string(),
    targetOutcome: z.string(),
    cognitiveStyle: z.string(),
    domainResearch: z.string().describe("Topic Research Agent 返回的领域研究结果"),
  }),
  execute: async (params) => {
    const result = await curriculumDesignerAgent.generate({
      prompt: "基于以下用户画像和领域研究，设计个性化课程大纲...",
      options: params,
    });
    return JSON.parse(result.text);
  },
});
```

#### Interview Agent 的 prepareCall

```typescript
export const interviewAgent = new ToolLoopAgent({
  id: "nexusnote-interview",
  model: interviewModel,
  tools: {
    presentOptions: presentOptionsTool,
    researchTopic: researchTopicTool,
    designCurriculum: designCurriculumTool,
  },
  maxOutputTokens: 4096,

  prepareCall: ({ messages, ...rest }) => {
    const context = extractContextFromMessages(messages);
    const instructions = buildInterviewPrompt(context);

    // 信息充分 → 强制调用 designCurriculum
    const hasAllInfo = Boolean(context.goal) && Boolean(context.background)
      && Boolean(context.targetOutcome) && Boolean(context.cognitiveStyle);

    if (hasAllInfo) {
      return {
        ...rest,
        instructions,
        toolChoice: { type: "tool", toolName: "designCurriculum" },
        stopWhen: stepCountIs(1),
      };
    }

    // 信息不足 → AI 自主决定调 researchTopic 还是 presentOptions
    // researchTopic 有 execute，调完循环继续 → AI 拿到研究结果后调 presentOptions
    // presentOptions 无 execute → 循环自动停止，等用户
    return { ...rest, instructions, temperature: 0.7 };
  },
});
```

### 完整流程

```
1. 用户输入 "我想学 Kubernetes"
2. Interview Agent 收到消息
3. Agent 决定先研究领域
4.   → 调用 researchTopic("Kubernetes")     [server-side, 自动执行]
5.   → Research Agent 搜索 web，返回领域摘要  [agent 循环继续]
6. Agent 拿到研究结果，生成有深度的回复
7.   → 调用 presentOptions（基于研究结果）    [client-side, 循环暂停]
8. 用户看到选项，点击 "应用开发者视角"
9. addToolOutput → sendAutomaticallyWhen → 下一轮请求
10. Agent 可能再次 researchTopic("Kubernetes 应用开发") 深入
11. Agent 调 presentOptions 问背景             [暂停，等用户]
12. 用户选择 → 下一轮
13. ...收集 targetOutcome、cognitiveStyle...
14. 信息充分 → Agent 调用 designCurriculum     [server-side]
15. Curriculum Designer 用 courseModel 生成专业大纲
16. 客户端收到大纲 → outline_review phase
```

### 不要做的事

| 反模式 | 原因 |
|--------|------|
| 让用户跟多个"角色"对话 | 像客服转接，体验割裂 |
| 给每个维度（背景/风格/目标）分配独立 agent | 过度拆分，单 agent 完全胜任 |
| 加"激励 agent"或"情感 agent" | 画蛇添足，prompt 能解决的事不用拆 agent |
| Research Agent 每轮都调用 | 浪费 token 和时间，只在主题变化时调用 |

### 判断标准：什么时候拆 Agent

```
单 agent prompt 能解决？
  ├── 能 → 不拆（如：收集背景、了解风格、语气调整）
  └── 不能 → 拆
       ├── 需要外部数据 → Research Agent（searchWeb）
       ├── 需要更强模型 → Specialist Agent（courseModel）
       └── 需要不同工具集 → Tool-specific Agent
```

### 新增文件清单

| 文件 | 说明 |
|------|------|
| `features/learning/agents/research/agent.ts` | Topic Research Agent 定义 |
| `features/learning/agents/curriculum/agent.ts` | Curriculum Designer Agent 定义 |
| `features/shared/ai/prompts/research.ts` | 领域研究 prompt |
| `features/shared/ai/prompts/curriculum.ts` | 课程设计 prompt |
| `features/learning/tools/interview.ts` | 新增 `researchTopic` + `designCurriculum` tool |

---

## 参考资料

- [AI SDK v6 Agents: Loop Control](https://ai-sdk.dev/docs/agents/loop-control) — `stopWhen`, `prepareStep`
- [AI SDK Chatbot Tool Usage](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-tool-usage) — client-side tools, `addToolOutput`
- [AI SDK Human-in-the-Loop](https://ai-sdk.dev/cookbook/next/human-in-the-loop) — `needsApproval`, interactive patterns
- [AI SDK v6 Announcement](https://vercel.com/blog/ai-sdk-6) — 架构概览
- [AI SDK Agents: Building Agents](https://ai-sdk.dev/docs/agents/building-agents) — agent 定义与组合
- [AI SDK Agents: Configuring Call Options](https://ai-sdk.dev/docs/agents/configuring-call-options) — `prepareCall` vs `prepareStep`
