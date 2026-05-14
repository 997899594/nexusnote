import type { UIMessage } from "ai";
import { extractUIMessageText } from "@/lib/ai/message-text";
import { loadPromptResource, renderPromptResource } from "@/lib/ai/prompts/load-prompt";
import type { InterviewOutline } from "./schemas";

const INTERVIEW_SYSTEM_PROMPT = loadPromptResource("interview-system.md");
const INTERVIEW_NATURAL_USER_PROMPT = "interview/natural-user.md";
const INTERVIEW_NATURAL_CURRENT_OUTLINE_PROMPT = "interview/natural-current-outline.md";
const INTERVIEW_NATURAL_NO_OUTLINE_PROMPT = loadPromptResource("interview/natural-no-outline.md");
const INTERVIEW_NATURAL_HINTS = {
  existingOutlineRules: loadPromptResource("interview/natural-existing-outline-rules.md"),
} as const;

function getLatestUserMessage(messages: Array<Pick<UIMessage, "role" | "parts">> | undefined) {
  const latestUserMessage = [...(messages ?? [])]
    .reverse()
    .find((message) => message.role === "user");

  if (!latestUserMessage) {
    return "";
  }

  return extractUIMessageText(latestUserMessage, { separator: " " }).trim();
}

function shouldDirectlyDraftOutline(message: string) {
  if (!message) {
    return false;
  }

  const hasTopicSignal =
    /想学|学习|课程|React|SQL|Python|PPT|汇报|作品集|转岗|求职|数据分析|前端|运营/.test(message);
  const hasBaselineSignal = /零基础|基础|我会|会一点|目前|现在|已经/.test(message);
  const hasOutcomeSignal = /想.*做|做一个|完成|独立完成|作品集|项目|两周后|转岗|求职|汇报/.test(
    message,
  );

  return hasTopicSignal && hasBaselineSignal && hasOutcomeSignal;
}

function buildInterviewDynamicHint(input: {
  currentOutline?: InterviewOutline;
  latestUserMessage: string;
}) {
  const message = input.latestUserMessage;
  if (!message) {
    return "";
  }

  if (input.currentOutline) {
    if (/(加一章|补一章|增加一章|新增一章)/.test(message)) {
      return [
        "## 本轮动态提示",
        "用户这轮是在现有大纲上新增章节。",
        "必须调用 presentOutlinePreview，并在同一次调用里返回完整可保存的 outline。",
        "必须保留现有章节主线；除非用户明确要求删除或替换，否则不要拿旧章节换新章节。",
        "如果用户说“加一章/补一章/增加一章/新增一章”，章节总数必须在当前基础上至少 +1。",
      ].join("\n");
    }

    return [
      "## 本轮动态提示",
      "当前存在可编辑大纲，本轮优先按修改请求直接输出更新后的完整课程蓝图。",
      "必须调用 presentOutlinePreview，并在同一次调用里返回完整可保存的 outline；只返回 message 或 options 视为未完成。",
    ].join("\n");
  }

  if (!shouldDirectlyDraftOutline(message)) {
    return "";
  }

  return [
    "## 本轮动态提示",
    "用户已经给出了学习主题、当前基础和明确产出或时间目标。",
    "本轮信息已经足够给第一版课程蓝图；优先直接调用 presentOutlinePreview。",
    "不要为了补细节再追问项目类型、风格偏好或行业细分，这些可以先做合理假设，再交给 revise 选项调整。",
  ].join("\n");
}

export function buildInterviewAgentInstructionsWithHint(input: {
  currentOutline?: InterviewOutline;
  messages?: Array<Pick<UIMessage, "role" | "parts">>;
}) {
  const latestUserMessage = getLatestUserMessage(input.messages);
  const dynamicHint = buildInterviewDynamicHint({
    currentOutline: input.currentOutline,
    latestUserMessage,
  });
  const currentOutlineBlock = input.currentOutline
    ? renderPromptResource(INTERVIEW_NATURAL_CURRENT_OUTLINE_PROMPT, {
        current_outline_json: JSON.stringify(input.currentOutline, null, 2),
      })
    : INTERVIEW_NATURAL_NO_OUTLINE_PROMPT;

  return [
    INTERVIEW_SYSTEM_PROMPT,
    renderPromptResource(INTERVIEW_NATURAL_USER_PROMPT, {
      current_outline_block: currentOutlineBlock,
      existing_outline_rules_block: input.currentOutline
        ? INTERVIEW_NATURAL_HINTS.existingOutlineRules
        : "",
    }),
    dynamicHint,
  ].join("\n\n");
}
