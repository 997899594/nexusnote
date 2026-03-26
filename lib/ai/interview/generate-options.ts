import { generateObject } from "ai";
import { z } from "zod";
import { getJsonModelForPolicy } from "@/lib/ai/core/model-policy";
import { getInterviewMessageText, type InterviewUIMessage } from "./ui";

const InterviewOptionsSchema = z.object({
  options: z.array(z.string().min(1).max(80)).min(2).max(4),
});

function formatRecentConversation(messages: InterviewUIMessage[]) {
  return messages
    .slice(-6)
    .map(
      (message) =>
        `${message.role === "user" ? "用户" : "助理"}: ${getInterviewMessageText(message)}`,
    )
    .filter(Boolean)
    .join("\n");
}

interface GenerateInterviewOptionsOptions {
  messages: InterviewUIMessage[];
  assistantText: string;
  hasOutline: boolean;
}

export async function generateInterviewOptions({
  messages,
  assistantText,
  hasOutline,
}: GenerateInterviewOptionsOptions): Promise<string[]> {
  if (!assistantText.trim()) {
    return [];
  }

  const result = await generateObject({
    model: getJsonModelForPolicy("interactive-fast"),
    schema: InterviewOptionsSchema,
    system: `你是课程访谈的快捷回复生成器。

你的职责是为当前这一轮助理回复生成 2 到 4 个可直接点击的中文短选项。

必须遵守：
- 选项必须像真实用户下一步可能会说的话
- 选项要简短、自然、可点击，尽量控制在 4 到 14 个汉字
- 不要解释，不要编号，不要输出思考过程
- 不要和助理正文逐字重复
- 如果当前已经有课程大纲，优先生成“修改/确认/继续”的选项
- 如果还在访谈中，优先生成能推进下一轮信息澄清的选项`,
    prompt: `【最近对话】
${formatRecentConversation(messages)}

【本轮助理回复】
${assistantText}

【当前是否已有大纲】
${hasOutline ? "是" : "否"}

请输出 options。`,
    temperature: 0.2,
    timeout: 12_000,
  });

  return Array.from(
    new Set(
      result.object.options
        .map((option) => option.trim())
        .filter((option) => option.length > 0 && option !== assistantText.trim()),
    ),
  ).slice(0, 4);
}
