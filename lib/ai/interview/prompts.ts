import type {
  InterviewApiMessage,
  InterviewOutline,
  InterviewState,
  InterviewSufficiency,
} from "./schemas";

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

export const INTERVIEW_STATE_SYSTEM_PROMPT = `你是 NexusNote 的访谈状态分析器。

你需要根据当前对话，提取足够驱动下一轮课程访谈的运行时状态。

必须遵守：
- mode 只能是 discover 或 revise
- 如果已有大纲，且用户在表达修改意见，优先判断为 revise
- goal/background/useCase 可以为空，但不要臆造
- constraints 和 preferences 可以根据上下文做弱推断，但不要过度补全
- openQuestions 只列最关键的 0 到 6 个问题
- confidence 表示“现在是否足够进入课程大纲阶段”的把握度，范围 0 到 1
- 不要输出思考过程`;

export function buildInterviewPrompt(input: {
  messages: InterviewApiMessage[];
  currentOutline?: InterviewOutline;
  state: InterviewState;
  sufficiency: InterviewSufficiency;
}) {
  return `以下是当前课程访谈上下文。

【对话历史】
${formatConversation(input.messages)}

【当前已生成大纲】
${formatOutline(input.currentOutline)}

【当前访谈状态】
${JSON.stringify(input.state, null, 2)}

【系统判定】
${JSON.stringify(input.sufficiency, null, 2)}

请基于以上上下文，输出当前这一轮的结构化结果。

额外要求：
- 如果 allowOutline 为 false，只能返回 kind="question"
- 如果 allowOutline 为 false，这一轮的问题要优先围绕 nextFocus
- 如果 mode 是 revise，优先处理对现有大纲的调整，不要重新从头访谈
- 如果 allowOutline 为 true，可以返回 kind="outline"，但必须是完整课程草案`;
}

export function buildInterviewStatePrompt(input: {
  messages: InterviewApiMessage[];
  currentOutline?: InterviewOutline;
}) {
  return `以下是当前课程访谈上下文。

【对话历史】
${formatConversation(input.messages)}

【当前已生成大纲】
${formatOutline(input.currentOutline)}

请提取当前访谈运行时状态。`;
}
