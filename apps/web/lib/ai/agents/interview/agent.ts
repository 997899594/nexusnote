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

import { ToolLoopAgent, InferAgentUIMessage, stepCountIs } from "ai";
import { string, z } from "zod";
import { chatModel } from "@/lib/ai/registry";
import { interviewTools } from "@/lib/ai/tools/interview";
import { buildInterviewPrompt } from "@/lib/ai/prompts/interview";

/**
 * Interview Context Schema - 统一的维度定义
 * Phase 1: Goal (学什么)
 * Phase 2: Background (基础如何)
 * Phase 3: TargetOutcome (为了什么)
 * Phase 4: CognitiveStyle (怎么学)
 */
export const InterviewContextSchema = z.object({
  goal: z.string().optional(),
  background: z.string().optional(),
  targetOutcome: z.string().optional(),
  cognitiveStyle: z.string().optional(),
});

export type InterviewContext = z.infer<typeof InterviewContextSchema>;

/**
 * Interview Agent 定义
 *
 * 与 Chat Agent 保持一致的架构模式
 */
export const interviewAgent = new ToolLoopAgent({
  id: "nexusnote-interview",
  model: chatModel!,
  tools: interviewTools,
  maxOutputTokens: 4096,
  callOptionsSchema: InterviewContextSchema,

  /**
   * prepareCall: 核心逻辑
   * 在每次 AI 调用前，动态构建 instructions
   */
  prepareCall: ({ options, ...rest }) => {
    const callOptions = (options ?? {}) as InterviewContext;

    console.log(
      "[Interview Agent] prepareCall called with options:",
      callOptions,
    );

    // L1: 动态构建 System Prompt
    // 这里是"代码控流"的关键：根据数据缺口注入不同的指令
    const instructions = buildInterviewPrompt(callOptions);

    console.log(
      "[Interview Agent] Generated instructions (first 500 chars):",
      instructions.slice(0, 500),
    );
    console.log(
      "[Interview Agent] Tools available:",
      Object.keys(interviewTools),
    );

    // 检测当前阶段
    const hasGoal = Boolean(callOptions.goal);
    const hasBackground = Boolean(callOptions.background);
    const hasTargetOutcome = Boolean(callOptions.targetOutcome);
    const hasCognitiveStyle = Boolean(callOptions.cognitiveStyle);
    const hasAllInfo = hasGoal && hasBackground && hasTargetOutcome && hasCognitiveStyle;

    console.log("[Interview Agent] Phase detection:", {
      hasGoal,
      hasBackground,
      hasTargetOutcome,
      hasCognitiveStyle,
      hasAllInfo,
    });

    // Phase 4: 信息收集完毕，强制调用 generateOutline
    if (hasAllInfo) {
      console.log(
        "[Interview Agent] ✅ All info collected, FORCING generateOutline",
      );
      return {
        ...rest,
        instructions,
        temperature: 0.8,
        toolChoice: { type: "tool", toolName: "generateOutline" },
        stopWhen: stepCountIs(1), // 调用工具后立即停止，不再输出文本
      };
    }

    // Phase 1-3: AI 自由调用 presentOptions
    return {
      ...rest,
      instructions,
      temperature: 0.7,
    };
  },
});

/**
 * 导出类型：客户端 useChat 泛型参数
 *
 * 使用方式：
 * ```typescript
 * import { type InterviewAgentMessage } from '@/lib/ai/agents/interview/agent'
 * const { messages } = useChat<InterviewAgentMessage>({ transport })
 * ```
 */
export type InterviewAgentMessage = InferAgentUIMessage<typeof interviewAgent>;

/**
 * 导出 Context 类型供外部使用
 *
 * 使用方式：
 * ```typescript
 * import type { InterviewContext } from '@/lib/ai/agents/interview/agent'
 * ```
 */
// InterviewContext 已在上方导出
