/**
 * Topic Research Agent
 *
 * 职责：研究用户想学的领域，获取最新信息、学习路径和前置知识
 *
 * 调用方式：Interview Agent 的 server-side tool（researchTopic）
 * 模型：chatModel（对话能力，支持 web search）
 */

import { z } from "zod";
import { registry } from "@/features/shared/ai/registry";

/**
 * Topic Research 输入
 */
export const TopicResearchInputSchema = z.object({
  topic: z.string().describe("用户想学的主题"),
  specificDirection: z.string().optional().describe("用户选择的具体方向"),
  userBackground: z.string().optional().describe("用户已有的背景"),
});

export type TopicResearchInput = z.infer<typeof TopicResearchInputSchema>;

/**
 * Topic Research 输出（结构化）
 */
export const TopicResearchOutputSchema = z.object({
  summary: z.string().describe("领域摘要，2-3句话说明这是什么"),
  currentVersion: z.string().optional().describe("当前最新版本/趋势，如 'K8s 1.32 Gateway API'"),
  recentTrends: z.array(z.string()).optional().describe("最新趋势或变化"),
  typicalLearningPath: z.array(z.string()).optional().describe("典型学习路径，从零基础到高级"),
  prerequisites: z.array(z.string()).optional().describe("前置知识或技能"),
  commonGoals: z.array(z.string()).optional().describe("常见学习目标"),
});

export type TopicResearchOutput = z.infer<typeof TopicResearchOutputSchema>;

const systemPrompt = `你是 NexusNote 的领域研究专家。用户会提供一个学习主题，你的任务是：

1. **领域摘要**：用 2-3 句话简洁说明这个领域是什么、为什么重要
2. **最新版本/趋势**：如果适用，提供当前主要版本或最近的重要变化（如 K8s Gateway API、React Server Components）
3. **典型学习路径**：列出 5-8 个从零基础到能实际应用的步骤（按顺序）
4. **前置知识**：列出开始前需要掌握的技能（如 Linux 基础、网络概念）
5. **常见学习目标**：列出人们学这个领域的典型目标（如考证书、部署应用、面试准备）

输出 JSON 格式，严格遵守 schema。`;

/**
 * 研究领域并返回结构化信息
 */
export async function researchTopic(
  input: TopicResearchInput,
): Promise<TopicResearchOutput> {
  const chatModel = registry.chatModel;
  if (!chatModel) {
    throw new Error("Chat model not configured");
  }

  const prompt = `研究「${input.topic}」${input.specificDirection ? `（方向：${input.specificDirection}）` : ""}${input.userBackground ? `，用户背景：${input.userBackground}` : ""}。

返回：领域摘要、最新趋势、典型学习路径、前置知识、常见目标。`;

  // 使用 AI SDK v6 正确 API：generateText + Output.object
  const { generateText, Output } = await import("ai");

  const { output } = await generateText({
    model: chatModel,
    system: systemPrompt,
    prompt,
    output: Output.object({
      schema: TopicResearchOutputSchema,
    }),
  });

  // output 是已经通过 schema 验证的结构化输出
  return output;
}
