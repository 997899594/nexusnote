import { loadPromptResource } from "@/lib/ai/prompts/load-prompt";
import {
  formatGrowthGenerationContext,
  type GrowthGenerationContext,
} from "@/lib/growth/generation-context-format";
import type {
  InterviewApiMessage,
  InterviewOutline,
  InterviewState,
  InterviewSufficiency,
} from "./schemas";

const STRUCTURED_STATE_SYSTEM_PROMPT = loadPromptResource("interview-state-system.md");
const STRUCTURED_INTERVIEW_SYSTEM_PROMPT = loadPromptResource("interview-structured-system.md");

function formatConversation(messages: InterviewApiMessage[]) {
  return messages
    .map((message) => `${message.role === "user" ? "用户" : "助理"}: ${message.text}`)
    .join("\n");
}

function formatOutline(outline: InterviewOutline | undefined) {
  return outline ? JSON.stringify(outline, null, 2) : "暂无已生成大纲。";
}

function buildFocusGuidance(
  nextFocus: InterviewSufficiency["nextFocus"],
  state: InterviewState,
): string {
  switch (nextFocus) {
    case "topic":
      return "下一问只负责帮助用户把“学什么”收窄到更明确的主题，不要顺手追问目标或基础。";
    case "targetOutcome":
      return "下一问只负责搞清楚“学完想达到什么结果”，例如工作结果、考试结果、作品结果或生活应用结果。";
    case "currentBaseline":
      return "下一问只负责确认用户当前大概处于什么基础，不要顺手再问目标。";
    case "constraints":
      return state.constraints.length > 0
        ? "当前约束已经有一些信号；下一问只补最关键但仍缺的限制条件，例如时间、深度、节奏或应用场景。"
        : "下一问只补一个关键约束，例如时间、节奏、深度边界或现实使用场景。";
    case "revision":
      return "下一问只帮助用户把修改意图说得更具体，例如想删什么、加强什么、顺序怎么调整。";
    default:
      return "";
  }
}

export function buildStructuredInterviewStatePrompt(input: {
  messages: InterviewApiMessage[];
  currentOutline?: InterviewOutline;
}) {
  return `以下是当前课程访谈上下文。

【对话历史】
${formatConversation(input.messages)}

【当前已生成大纲】
${formatOutline(input.currentOutline)}

请基于这段上下文提取结构化访谈状态。`;
}

export function buildStructuredInterviewAgentInstructions(input: {
  messages: InterviewApiMessage[];
  currentOutline?: InterviewOutline;
  state: InterviewState;
  sufficiency: InterviewSufficiency;
  latestUserMessage?: string;
  generationContext?: GrowthGenerationContext;
}) {
  const action = input.sufficiency.allowOutline ? "outline" : "question";
  const focusGuidance =
    action === "question" ? buildFocusGuidance(input.sufficiency.nextFocus, input.state) : null;

  return `${STRUCTURED_INTERVIEW_SYSTEM_PROMPT}

【当前对话历史】
${formatConversation(input.messages)}

【当前已生成大纲】
${formatOutline(input.currentOutline)}

【代码抽取后的访谈状态】
${JSON.stringify(input.state, null, 2)}

【代码判定】
${JSON.stringify(input.sufficiency, null, 2)}

【本轮执行计划】
- action: ${action}
${action === "question" ? `- focus: ${input.sufficiency.nextFocus}\n- ${focusGuidance}` : "- focus: 直接生成完整课程草案"}

【已知事实】
- 学什么：${input.state.topic ?? "未明确"}
- 想达到什么结果：${input.state.targetOutcome ?? "未明确"}
- 当前大概基础：${input.state.currentBaseline ?? "未明确"}
- 关键约束：${input.state.constraints.length > 0 ? input.state.constraints.join("、") : "未明确"}
- 修改意图：${input.state.revisionIntent ?? "无"}

当前成长上下文：
${formatGrowthGenerationContext(input.generationContext, { style: "detailed" })}

执行要求：
- 代码已经决定本轮是继续追问还是直接给大纲，你不能更改 action
- 如果 action=question，只能围绕 focus 推进一个问题，不要同时追问多个维度
- 如果 action=outline，直接给完整课程草案，不要再附带新的追问
- 这是全领域课程访谈，不默认用户学的是技术主题
- 不要重复确认用户已经明确说过的信息
- 不要输出思考过程
- options 保持 2 到 4 个，短、清晰、可点击
- 如果已有大纲并且当前是修改语境，优先在原大纲上做增量调整
- 最新用户表达：${input.latestUserMessage?.trim() || "无"}
`;
}

export { STRUCTURED_INTERVIEW_SYSTEM_PROMPT, STRUCTURED_STATE_SYSTEM_PROMPT };
