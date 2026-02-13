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

import { type InferAgentUIMessage, type LanguageModel, stepCountIs, ToolLoopAgent } from "ai";
import { z } from "zod";
import { buildInterviewPrompt } from "@/features/shared/ai/prompts/interview";
import { registry } from "@/features/shared/ai/registry";
import { interviewTools } from "@/lib/ai/tools/interview";

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

/**
 * Interview Agent 定义
 *
 * 与 Chat Agent 保持一致的架构模式
 * 集成 extractReasoningMiddleware 显示 AI 的思考过程
 */

/**
 * Interview Agent 定义
 *
 * chatModel 已在 registry 中通过 wrapLanguageModel 应用了推理中间件
 * 无需再次包装，直接使用即可
 */
export const interviewAgent = new ToolLoopAgent({
  id: "nexusnote-interview",
  model: interviewModel as LanguageModel, // 运行时会检查，构建时使用类型断言
  tools: interviewTools,
  maxOutputTokens: 4096,
  callOptionsSchema: InterviewContextSchema,

  /**
   * prepareCall: 核心逻辑
   * 在每次 AI 调用前，动态构建 instructions
   */
  prepareCall: ({ options, ...rest }) => {
    const callOptions = (options ?? {}) as InterviewContext;
    const callId = crypto.randomUUID().slice(0, 8);

    console.log(
      `[Interview Agent.${callId}] prepareCall called with options:`,
      JSON.stringify(callOptions, null, 2),
    );
    console.log(`[Interview Agent.${callId}] rest keys:`, Object.keys(rest));

    // L1: 动态构建 System Prompt
    // 这里是"代码控流"的关键：根据数据缺口注入不同的指令
    const instructions = buildInterviewPrompt(callOptions);

    console.log(
      `[Interview Agent.${callId}] Generated instructions (first 500 chars):`,
      instructions.slice(0, 500),
    );
    console.log(`[Interview Agent.${callId}] Tools available:`, Object.keys(interviewTools));

    // 检测当前阶段
    const hasGoal = Boolean(callOptions.goal);
    const hasBackground = Boolean(callOptions.background);
    const hasTargetOutcome = Boolean(callOptions.targetOutcome);
    const hasCognitiveStyle = Boolean(callOptions.cognitiveStyle);
    const hasAllInfo = hasGoal && hasBackground && hasTargetOutcome && hasCognitiveStyle;

    console.log(`[Interview Agent.${callId}] Phase detection:`, {
      hasGoal,
      hasBackground,
      hasTargetOutcome,
      hasCognitiveStyle,
      hasAllInfo,
    });
    console.log(
      `[Interview Agent.${callId}] User Profile Summary:`,
      JSON.stringify(
        {
          goal: callOptions.goal,
          background: callOptions.background,
          targetOutcome: callOptions.targetOutcome,
          cognitiveStyle: callOptions.cognitiveStyle,
        },
        null,
        2,
      ),
    );

    // Phase 4: 信息收集完毕，强制调用 generateOutline
    if (hasAllInfo) {
      console.log(`[Interview Agent.${callId}] ✅ All info collected, FORCING generateOutline`);
      return {
        ...rest,
        instructions,
        temperature: 0.7,
        toolChoice: { type: "tool", toolName: "generateOutline" },
      };
    }

    // Phase 1-3: 首次消息必须调用 presentOptions
    const isFirstMessage = !callOptions.goal && !callOptions.background;

    if (isFirstMessage) {
      console.log(`[Interview Agent.${callId}] 🔄 First message, FORCING presentOptions`);
      return {
        ...rest,
        instructions,
        temperature: 0.7,
        toolChoice: { type: "tool", toolName: "presentOptions" },
      };
    }

    console.log(`[Interview Agent.${callId}] 🔄 Continuing conversation`);
    return {
      ...rest,
      instructions,
      temperature: 0.7,
      stopWhen: stepCountIs(3),
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
export type InterviewTools = typeof interviewTools;
