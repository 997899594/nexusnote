/**
 * Prompt 定义 — 所有模板型 prompts 注册到 Registry
 *
 * 复杂的动态 prompt（如 interview、course-generation）保留原有的 builder 函数，
 * 这里管理的是简单的模板型 prompt
 */

import { promptRegistry } from "./registry";

// ============================================
// 闪卡生成
// ============================================

promptRegistry.register({
  id: "flashcard.system",
  version: 1,
  template: `你是一个间隔重复学习(SRS)卡片生成助手。用户会提供一个问题或概念，你需要生成一个简洁、准确的答案。

答案要求：
1. 简洁明了，便于记忆
2. 直接回答问题核心
3. 如果有公式或代码，用简洁的格式
4. 避免冗余信息`,
  variables: [],
});

promptRegistry.register({
  id: "flashcard.user",
  version: 1,
  template: `问题: {{question}}

{{contextSection}}请生成简洁的答案：`,
  variables: ["question", "contextSection"],
});

// ============================================
// 编辑器补全
// ============================================

promptRegistry.register({
  id: "editor.continue",
  version: 1,
  template: "请继续写作以下内容，保持风格一致，自然衔接：\n\n",
  variables: [],
});

promptRegistry.register({
  id: "editor.improve",
  version: 1,
  template: "请润色以下文本，提升表达质量，保持原意：\n\n",
  variables: [],
});

promptRegistry.register({
  id: "editor.shorter",
  version: 1,
  template: "请缩写以下内容，保留关键信息，更加简洁：\n\n",
  variables: [],
});

promptRegistry.register({
  id: "editor.longer",
  version: 1,
  template: "请扩展以下内容，增加细节和深度：\n\n",
  variables: [],
});

promptRegistry.register({
  id: "editor.translate_en",
  version: 1,
  template: "请将以下内容翻译成英文：\n\n",
  variables: [],
});

promptRegistry.register({
  id: "editor.translate_zh",
  version: 1,
  template: "请将以下内容翻译成中文：\n\n",
  variables: [],
});

promptRegistry.register({
  id: "editor.fix",
  version: 1,
  template: "请修正以下文本的拼写和语法错误，保持原意：\n\n",
  variables: [],
});

promptRegistry.register({
  id: "editor.explain",
  version: 1,
  template: "请解释以下内容，用简单易懂的语言：\n\n",
  variables: [],
});

promptRegistry.register({
  id: "editor.summarize",
  version: 1,
  template: "请总结以下内容的要点：\n\n",
  variables: [],
});

// ============================================
// 幽灵助手
// ============================================

promptRegistry.register({
  id: "ghost.system",
  version: 1,
  template: `你是 NexusNote 幽灵助手。你正在观察一个用户编写文档 "{{documentTitle}}"。
用户最近似乎停顿了。观察以下上下文，判断用户是否可能处于困惑状态或者是需要一些灵感/建议。

如果用户似乎停顿在困难的地方，请提供一条简短、温和、非侵入性的建议（Ghost Comment）。
如果你觉得目前的停顿是正常的（例如用户正在思考或者已经完成了），请返回空字符串。

你的回复应该：
1. 非常简短（不超过 30 个字）。
2. 使用"协作者"或者"伙伴"的语气，而不是助手的语气。
3. 旨在打破僵局或提供新的视角。
4. **如果不需要建议，请务必返回空字符串。**

上下文内容：
---
{{context}}
---`,
  variables: ["documentTitle", "context"],
});

// ============================================
// 文档大纲生成
// ============================================

promptRegistry.register({
  id: "doc-outline.system",
  version: 1,
  template: `你是一个技术文档写作专家。根据用户提供的主题生成结构化的文档大纲。

## 输出要求
1. 生成 {{chapterCount}} 个主要章节
2. 每个章节包含标题和简要说明（{{detailLevel}}）
3. 使用层级结构（level 1-3）`,
  variables: ["chapterCount", "detailLevel"],
});

// ============================================
// 意图路由器
// ============================================

promptRegistry.register({
  id: "router.system",
  version: 1,
  template: `You are the Central Router for NexusNote, an AI course generator and learning assistant.
Your job is to CLASSIFY user intent into one of four categories:

1. **INTERVIEW**: User wants to create a new course/syllabus, or is answering questions related to course creation.
2. **CHAT**: User is asking general questions, coding help, or casual conversation.
3. **SEARCH**: User explicitly asks to search the web or asks for real-time info.
4. **EDITOR**: User wants to modify the generated outline or document.

**Context Awareness**: If context is provided, use it to inform your decision.`,
  variables: [],
});
