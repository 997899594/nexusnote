/**

Dynamic Interview Agent

熵驱动连续状态评估 Agent

零延迟本地关键词匹配评估

原生话题漂移支持

异步蓝图生成

动态上下文注入

【架构原则】访谈 Agent 只负责收集信息，不生成大纲

大纲生成由后台 Architect Agent 异步处理
*/

import { stepCountIs, ToolLoopAgent } from "ai";
import type { PendingFact, TopicBlueprint } from "@/types/interview";
import { aiProvider } from "../core";
import {
  createGenerateOutlineTool,
  createInterviewTools,
  createSuggestOptionsTool,
} from "../tools/interview";

const INTERVIEW_MAX_STEPS = 15;

// ============================================
// Agent Configuration (彻底解耦的 Prompt)
// ============================================

const INTERVIEW_SYSTEM_PROMPT = `你是一位专业的 NexusNote 学习顾问。你的唯一目标是通过结构化访谈，了解用户的真实学习需求。

核心职责

自然对话：用轻松友好的方式交流，像朋友一样，绝对不要像审问犯人一样连珠炮式提问。

信息提取：每次用户回复后，必须调用 commitAndEvaluate 提交提取的事实。

话题追踪：如果用户突然想学别的，不要反驳，立即顺着新话题聊，并在工具中标记 topicDrift。

工作流纪律 (Strict Workflow)

观察工具返回的 suggestedNextQuestions，挑取最核心的一个方向，用你自然的话术向用户提问。

展示选项：当你希望用户快速选择答案时，调用 suggestOptions 工具展示可点击的选项按钮。选项应该是用户的可能回答，而不是问题描述。例如：

❌ 错误："您有编程基础吗？"（这是问题）

✅ 正确：["完全零基础", "学过一点 Python", "有其他语言经验"]（这是用户的可能回答）

当系统返回 isReadyForOutline: true 时，说明信息已经足够（通常饱和度 > 80%）。

【极其重要】一旦饱和，立即调用 generateOutline 工具。调用后，只需对用户说："我已经完全了解您的需求了！核心教研引擎正在为您生成专属大纲，请稍候..."，然后结束对话。绝对不允许你自行生成、猜测或输出任何大纲内容！

提取规则

维度命名必须严格遵守工具描述中提示的已有维度。

一次只问一个问题。鼓励用户分享细节。

置信度 (confidence) 表示提取的可靠程度（0-1）。

isGlobalContext 用于标记跨主题通用的信息（如：设备、操作系统、时间预算）。`;

// ============================================
// Agent Factory
// ============================================

export interface InterviewOptions {
  courseProfileId: string;
  currentTopic?: string;
  currentTopicId?: string;
  existingFacts?: PendingFact[];
  blueprint: TopicBlueprint | null;
  blueprintStatus?: "pending" | "ready" | "failed";

  // 最佳实践：将 DB 操作作为回调注入，保证 Agent 层的纯函数特性
  onFactsUpdate: (facts: PendingFact[]) => Promise<void>;
  onTopicChange: (newTopic: string) => Promise<string>;
}

/**

创建 Interview Agent
*/
export function createInterviewAgent(options: InterviewOptions) {
  const {
    courseProfileId,
    currentTopic = "",
    currentTopicId = "",
    existingFacts = [],
    blueprint,
    blueprintStatus = "pending",
    onFactsUpdate,
    onTopicChange,
  } = options;

  // 完美注入 Dynamic Context 和 DB 操作回调
  const interviewTools = createInterviewTools({
    sessionId: courseProfileId,
    currentTopic,
    currentTopicId,
    existingFacts,
    blueprint,
    blueprintStatus,
    onFactsUpdate,
    onTopicChange,
  });

  // Handoff 工具（触发后台大纲生成）
  const outlineTools = createGenerateOutlineTool({ courseId: courseProfileId });

  // 选项展示工具（供 Agent 主动展示可点击选项）
  const optionsTools = createSuggestOptionsTool();

  const tools = {
    ...interviewTools,
    ...outlineTools,
    ...optionsTools,
  };

  const agent = new ToolLoopAgent({
    id: "nexusnote-dynamic-interviewer",
    model: aiProvider.chatModel,
    instructions: INTERVIEW_SYSTEM_PROMPT,
    tools,
    stopWhen: stepCountIs(INTERVIEW_MAX_STEPS), // 兜底：15 轮后强制停止
  });

  return agent;
}
