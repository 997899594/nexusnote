/**
 * Interview Agent - NexusNote 2026 Architecture
 * 使用 ToolLoopAgent 架构，与 Chat Agent 保持一致
 *
 * 核心特性：
 * 1. 动态 Prompt 构建 - 基于数据缺口自动切换阶段
 * 2. 多步推理 - 支持 AI 自主决策工具调用
 * 3. 类型安全 - 完整的 TypeScript 支持
 * 4. 可观测性 - 集成 Langfuse 追踪
 */

import { type InferAgentUIMessage, type LanguageModel, type ModelMessage, stepCountIs, ToolLoopAgent } from "ai";
import { z } from "zod";
import { interviewTools } from "@/features/learning/tools/interview";
import { buildInterviewPrompt } from "@/features/shared/ai/prompts/interview";
import { registry } from "@/features/shared/ai/registry";

const interviewModel = registry.chatModel;

/**
 * Interview Context Schema - 统一的维度定义
 * Phase 1: Goal (学什么)
 * Phase 2: Background (基础如何)
 * Phase 3: TargetOutcome (为了什么)
 * Phase 4: CognitiveStyle (怎么学)
 *
 * 扩展：支持课程画像持久化，便于后续 Agent 或页面访问
 */
export const InterviewContextSchema = z.object({
  // 用户信息维度
  goal: z.string().describe("学习目标"),
  background: z.string().describe("学习背景/水平"),
  targetOutcome: z.string().describe("预期成果"),
  cognitiveStyle: z.string().describe("学习风格"),

  // 课程画像存储（生成大纲后填充）
  courseId: z.string().optional().describe("生成的课程 ID"),
  userId: z.string().optional().describe("用户 ID（从 session 获取）"),
});

export type InterviewContext = z.infer<typeof InterviewContextSchema>;

const InterviewCallOptionsSchema = z.object({
  userId: z.string().optional().describe("从 session 获取的用户 ID"),
});

export const interviewAgent = new ToolLoopAgent({
  id: "nexusnote-interview",
  model: interviewModel as LanguageModel,
  tools: interviewTools,
  maxOutputTokens: 4096,
  callOptionsSchema: InterviewCallOptionsSchema,

  prepareCall: ({ messages, ...rest }) => {
    const context = extractContextFromMessages(messages ?? []);
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

    return { ...rest, instructions, temperature: 0.7 };
  },
});

/**
 * 从消息历史中解析 presentOptions 的 tool result，重建用户选择
 *
 * 遍历所有 tool role 消息，找到 presentOptions 的 tool-result，
 * 提取 selected 和 targetField 字段，填充 InterviewContext。
 */
export function extractContextFromMessages(messages: ModelMessage[]): InterviewContext {
  const context: InterviewContext = {
    goal: "",
    background: "",
    targetOutcome: "",
    cognitiveStyle: "",
  };

  for (const msg of messages) {
    if (msg.role !== "tool" || !Array.isArray(msg.content)) continue;

    for (const part of msg.content) {
      if (part.type !== "tool-result" || part.toolName !== "presentOptions") continue;

      try {
        let parsed: Record<string, unknown>;
        const output = part.output as { type: string; value: unknown };

        if (output.type === "json") {
          parsed = output.value as Record<string, unknown>;
        } else if (output.type === "text") {
          parsed = JSON.parse(output.value as string);
        } else {
          continue;
        }

        const { selected, targetField } = parsed as {
          selected?: string;
          targetField?: string;
        };

        if (
          selected &&
          targetField &&
          targetField !== "general" &&
          targetField in context
        ) {
          context[targetField as keyof Pick<InterviewContext, "goal" | "background" | "targetOutcome" | "cognitiveStyle">] = selected;
        }
      } catch {
        // Skip malformed tool results
      }
    }
  }

  return context;
}

/**
 * 导出类型：客户端 useChat 泛型参数
 *
 * 使用方式：
 * ```typescript
 * import { type InterviewAgentMessage } from '@/features/learning/agents/interview/agent'
 * const { messages } = useChat<InterviewAgentMessage>({ transport })
 * ```
 */
export type InterviewAgentMessage = InferAgentUIMessage<typeof interviewAgent>;
export type InterviewTools = typeof interviewTools;
