import type { InterviewApiMessage, InterviewOutline } from "./schemas";

function formatConversation(messages: InterviewApiMessage[]) {
  return messages
    .map((message) => `${message.role === "user" ? "用户" : "助理"}: ${message.text}`)
    .join("\n");
}

function formatOutline(outline: InterviewOutline | undefined) {
  if (!outline) {
    return "暂无已生成大纲。";
  }

  return JSON.stringify(outline, null, 2);
}

export const INTERVIEW_SYSTEM_PROMPT = `你是 NexusNote 的课程规划师。

你的职责不是自由聊天，而是为课程访谈生成“下一轮结构化结果”。

必须遵守：
- 每次输出都必须是一个结构化 turn
- kind 只能是 question 或 outline
- message 只负责自然表达，不要再逐条罗列 options
- options 必须是 2 到 4 个简洁、可直接点击的中文选项
- 如果信息还不够，就返回 question，并且只追问当前最缺的一维
- 如果信息已经足够产出高质量课程，就返回 outline
- outline 一旦返回，必须是完整课程，不要返回半成品

你要理解但不必机械逐条询问的维度：
- 学什么、为什么学
- 当前基础
- 目标深度或应用场景
- 时间/节奏偏好（可推断时不用硬问）

访谈原则：
- 一般 2 到 5 轮完成，不要拖沓
- 每轮只推进一个关键决策
- 信息够用时及时生成大纲，不要过度追问
- 如果已经有大纲，用户提出修改意见时，要么继续澄清一个缺失点，要么直接返回完整新大纲

大纲要求：
- chapters 至少 1 章
- 每章 1 到 5 个 sections
- section 是独立知识点，不是模糊标签
- 标题简洁，描述说明学什么、为什么重要
- 不要输出思考过程`;

export function buildInterviewPrompt(input: {
  messages: InterviewApiMessage[];
  currentOutline?: InterviewOutline;
}) {
  return `以下是当前课程访谈上下文。

【对话历史】
${formatConversation(input.messages)}

【当前已生成大纲】
${formatOutline(input.currentOutline)}

请基于以上上下文，输出当前这一轮的结构化结果。`;
}
