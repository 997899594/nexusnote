# NexusNote AI 系统事无巨细技术规格书 (2026 架构评审专用)

本手册是 NexusNote AI 系统的全量技术实现还原，包含 100% 的提示词模板、状态流转代码逻辑以及工具协议。旨在提供最深度的技术评审依据。

---

## 1. 神经中枢：L0 意图路由 (The Central Router)

**核心文件**: [route.ts](file:///Users/findbiao/projects/nexusnote/apps/web/lib/ai/router/route.ts)

### 1.1 完整系统提示词 (System Prompt)

```text
You are the Central Router for NexusNote, an AI course generator and learning assistant.
Your job is to CLASSIFY user intent into one of four categories:

1. **INTERVIEW**:
   - User wants to create a new course/syllabus.
   - User is answering questions related to course creation (goals, background, time).
   - Keywords: "create course", "learn python", "syllabus", "beginner", "2 hours a week".

2. **CHAT**:
   - User is asking general questions, coding help, or casual conversation.
   - User is asking about existing content (RAG).
   - Keywords: "how does react work?", "explain this code", "hello".

3. **SEARCH**:
   - User explicitly asks to search the web or asks for real-time info.
   - Keywords: "search for", "latest news", "current weather".

4. **EDITOR**:
   - User wants to modify the generated outline or document.
   - Keywords: "change chapter 1", "add a section", "rewrite this".

**Context Awareness**:
If 'context' is provided, use it to inform your decision. For example, if the user is in the middle of an interview (state: ASK_GOAL), even a short answer like "Python" should be routed to INTERVIEW.
```

### 1.2 路由执行逻辑

- **模型**: `registry.fastModel` (Gemini 3 Flash)。
- **温度**: `0` (确保分类幂等性)。
- **输入组合**: `Context: ${context || "None"}` + `User Input: "${input}"`。
- **输出 Schema**: `target` (枚举), `reasoning` (字符串), `parameters` (动态对象)。

---

## 2. 访谈专家：L1/L2 Interview Agent

**核心文件**: [agent.ts](file:///Users/findbiao/projects/nexusnote/apps/web/lib/ai/agents/interview/agent.ts) | [interview.ts](file:///Users/findbiao/projects/nexusnote/apps/web/lib/ai/prompts/interview.ts)

### 2.1 状态迁移与变量注入逻辑

系统通过 `injectTaskByPhase(context)` 函数，根据 `InterviewContext` 的布尔值状态进行实时 Prompt 组装：

| 状态判定条件              | 对应阶段    | 注入指令 (TASK)                                          |
| :------------------------ | :---------- | :------------------------------------------------------- |
| `!context.goal`           | **Phase 1** | "用户刚告诉你想学什么。回应兴趣，问他想往哪个方向深入。" |
| `!context.background`     | **Phase 2** | "认可选择「${context.goal}」，然后询问基础基础。"        |
| `!context.targetOutcome`  | **Phase 3** | "了解他学完想达成什么具体目标或项目。"                   |
| `!context.cognitiveStyle` | **Phase 4** | "最后一个问题。了解他偏好的学习方式（实战 vs 原理）。"   |
| `hasAllInfo`              | **Phase 5** | "信息收集完毕，调用 generateOutline 生成课程。"          |

### 2.2 完整 System Prompt 模板

```text
你是一位温暖专业的课程导师，正在通过对话了解用户的学习需求。

【强制规则 - 必须遵守】
❌ 错误示范：直接调用 presentOptions，不说任何话
✅ 正确示范：先输出一段对话文字（回应用户 + 提问），然后再调用 presentOptions
你必须先说话，再调用工具。这是硬性要求。

【对话原则】
- 对话是主体：你在和真人聊天，要有好奇心，要回应用户。
- 选项是辅助：presentOptions 只是降低用户输入成本。
- 每次只问一件事：目标 -> 背景 -> 预期成果 -> 学习风格。

【联网搜索触发协议】
在涉及前沿技术（如 AI, Next.js 15）、疑难名词或用户纠错时，必须主动使用 searchWeb 工具。

${TASK} // 动态注入的状态指令

现在，请先输出你的对话回复，然后调用工具。你的回复：
```

### 2.3 Agent 控流策略 (Control Flow)

- **`stopWhen: hasToolCall("presentOptions")`**: 确保 UI 卡片弹出时，AI 停止输出。
- **`toolChoice: "generateOutline"`**: 在 Phase 5 强制锁定，不给 AI 废话的机会。

---

## 3. 内容创作者：L1/L2 Course Gen Agent

**核心文件**: [agent.ts](file:///Users/findbiao/projects/nexusnote/apps/web/lib/ai/agents/course-generation/agent.ts) | [course-generation.ts](file:///Users/findbiao/projects/nexusnote/apps/web/lib/ai/prompts/course-generation.ts)

### 3.1 进度感知 Prompt (Contextual Progress)

```text
【学生背景】目标: ${context.goal} | 基础: ${context.background} | 风格: ${context.cognitiveStyle}
【课程信息】名称: ${context.outlineTitle} | 总章节: ${context.totalChapters}
【生成进度】已生成: ${context.chaptersGenerated}/${context.totalChapters} | 当前章节: ${context.currentChapterIndex + 1}
```

### 3.2 任务分发指令

- **首章 (isFirstChapter)**: "生成第一章节内容。要求：充满吸引力的开场 + 核心概念解释 + 场景应用。"
- **末章 (isLastChapter)**: "生成最后一章节。要求：承上启下 + 总结升华 + 目标达成确认。保存后调用 markGenerationComplete。"
- **常规章节**: "自然承接上一章节，深入讲解核心概念，结合学生风格提供例子。"

### 3.3 核心工具执行逻辑

- **`saveChapterContent`**: AI 生成后直接在后端执行 `db.insert`。
- **`temperature: 0.8`**: 保持创作的灵活性与多样性。

---

## 4. 工具协议全规格 (L3 Tools)

### 4.1 `presentOptions` (交互卡片)

- **参数**:
  - `question`: 5-10字标题。
  - `options`: 2-4个选项字符串。
  - `targetField`: `goal | background | targetOutcome | cognitiveStyle`。
- **业务逻辑**: 前端 UI 拦截该工具调用，将 `options` 渲染为点击按钮。

### 4.2 `generateOutline` (大纲生成)

- **参数**: `title`, `description`, `difficulty`, `estimatedMinutes`, `modules` (数组), `reason`。
- **约束**: `modules` 数量需根据 `targetOutcome` 复杂度动态调整（2-20个）。

### 4.3 `saveChapterContent` (持久化)

- **约束**: `contentMarkdown` 长度必须 **>= 200 字**，否则拒绝保存。

---

## 5. 基础设施：Registry & Middleware

### 5.1 模型中间件注入细节

**文件**: [registry.ts](file:///Users/findbiao/projects/nexusnote/apps/web/lib/ai/registry.ts)

1.  **Thinking 提取器 (`extractReasoningMiddleware`)**:
    - 配置: `tagName: 'thinking'`, `separator: '\n\n---\n\n'`。
    - 作用: 实时正则匹配并分离 AI 的“心流”过程，存储在消息的 `reasoning` 字段。
2.  **One-shot 示例注入 (`addToolInputExamplesMiddleware`)**:
    - 作用: 在所有 Tool 的 Description 后追加 `示例调用：{...}`，强制纠正模型对 JSON 格式的幻觉。

### 5.2 模型分级定义

- **Tier: Fast (Gemini 3 Flash)**: 极速分类与简单交互。
- **Tier: Power (Gemini 3 Pro)**: 深度内容创作与逻辑推理。

---

## 6. 开发者审计 Checklist (事无巨细版)

1.  **路由准确性**: 检查 [route.ts](file:///Users/findbiao/projects/nexusnote/apps/web/lib/ai/router/route.ts) 的 `Context Awareness` 提示词是否能防止短语输入被误分类。
2.  **状态机完备性**: 检查 [interview.ts](file:///Users/findbiao/projects/nexusnote/apps/web/lib/ai/prompts/interview.ts) 的 `injectTaskByPhase` 是否覆盖了 2^4 = 16 种上下文组合（当前为线性流转）。
3.  **截断体验**: 评审 `stopWhen` 导致的文字流中断是否可以通过前端“延迟渲染”或后端“强制补全”解决。
4.  **内容深度**: 检查 `saveChapterContent` 的 `min(200)` 约束是否在 `Course Gen Agent` 的 Prompt 中得到了充分强调。
