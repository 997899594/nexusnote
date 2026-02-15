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

import {
  type InferAgentUIMessage,
  type LanguageModel,
  stepCountIs,
  tool,
  ToolLoopAgent,
  type ModelMessage,
} from "ai";
import { z } from "zod";
import { interviewTools } from "@/features/learning/tools/interview";
import { buildInterviewPrompt } from "@/features/shared/ai/prompts/interview";
import { registry } from "@/features/shared/ai/registry";
import { researchTopic, type TopicResearchOutput } from "@/features/learning/agents/research/agent";
import { designCurriculum, type CurriculumOutput } from "@/features/learning/agents/curriculum/agent";

const interviewModel = registry.chatModel;

/**
 * Interview Context Schema - 统一的维度定义
 * Phase 1: Goal (学什么)
 * Phase 2: Background (基础如何)
 * Phase 3: TargetOutcome (为了什么)
 * Phase 4: CognitiveStyle (怎么学)
 *
 * 扩展：支持课程画像持久化，便于后续 Agent 或页面访问
 *
 * 架构说明：
 * - InterviewContext: 完整的访谈上下文（从消息历史提取）
 * - InterviewCallOptions: Agent 调用时传入的 options（仅包含外部传入的字段）
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

/**
 * Agent 调用时的 Options Schema
 *
 * 设计原则：
 * - 只包含需要从外部传入的字段
 * - 其他字段从消息历史中通过 extractContextFromMessages 提取
 */
export const InterviewCallOptionsSchema = z.object({
  // 可选：用户 ID（从 session 传入，用于数据持久化）
  userId: z.string().optional().describe("用户 ID（从 session 获取）"),

  // 可选：预设的初始值（通常为空，由 AI 通过对话收集）
  goal: z.string().optional().describe("预设的学习目标（可选）"),
  background: z.string().optional().describe("预设的学习背景（可选）"),
  targetOutcome: z.string().optional().describe("预设的预期成果（可选）"),
  cognitiveStyle: z.string().optional().describe("预设的学习风格（可选）"),
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
/**
 * 从 Agent 调用选项中提取初始上下文
 *
 * 架构说明：
 * - options 中的字段都是可选的，用于提供预设值
 * - 如果没有提供，返回空字符串（表示需要通过对话收集）
 * - 真正的上下文由 prepareStep 中的 extractContextFromMessages 从消息历史提取
 */
function extractContextFromOptions(options: unknown): InterviewContext {
  if (options && typeof options === "object") {
    const opts = options as Partial<InterviewContext>;
    return {
      goal: opts.goal ?? "",
      background: opts.background ?? "",
      targetOutcome: opts.targetOutcome ?? "",
      cognitiveStyle: opts.cognitiveStyle ?? "",
      userId: opts.userId,
    };
  }
  return {
    goal: "",
    background: "",
    targetOutcome: "",
    cognitiveStyle: "",
  };
}

/**
 * Interview Agent 扩展工具集
 * 包含原有工具 + 新增的研究和设计工具
 */
const interviewToolsExtended = {
  ...interviewTools,
  researchTopic: tool({
    description: "研究用户想学的领域，获取最新信息、学习路径和前置知识",
    inputSchema: z.object({
      topic: z.string().describe("用户想学的主题"),
      specificDirection: z.string().optional().describe("用户选择的具体方向"),
      userBackground: z.string().optional().describe("用户已有的背景"),
    }),
    execute: async ({ topic, specificDirection, userBackground }) => {
      const researchResult = await researchTopic({
        topic,
        specificDirection,
        userBackground,
      });

      // 返回结构化的领域研究，作为 JSON 字符串
      return JSON.stringify(researchResult);
    },
  }),
  designCurriculum: tool({
    description: "基于用户画像和领域研究设计个性化课程大纲",
    inputSchema: z.object({
      goal: z.string().describe("学习目标"),
      background: z.string().describe("学习背景"),
      targetOutcome: z.string().describe("预期成果"),
      cognitiveStyle: z.string().describe("学习风格"),
      domainResearch: z.string().describe("Topic Research Agent 返回的领域研究结果（JSON 字符串）"),
    }),
    execute: async (input) => {
      const domainResearch = JSON.parse(input.domainResearch) as TopicResearchOutput;

      const curriculumResult = await designCurriculum({
        userProfile: {
          goal: input.goal,
          background: input.background,
          targetOutcome: input.targetOutcome,
          cognitiveStyle: input.cognitiveStyle,
        },
        domainResearch,
      });

      // 返回课程大纲，作为 JSON 字符串
      return JSON.stringify(curriculumResult);
    },
  }),
};

export const interviewAgent = new ToolLoopAgent({
  id: "nexusnote-interview",
  model: interviewModel as LanguageModel,
  tools: interviewToolsExtended,
  maxOutputTokens: 4096,
  callOptionsSchema: InterviewCallOptionsSchema,

  /**
   * prepareCall: 请求级配置
   * - 构建动态 instructions（基于 call options）
   * - 设置 temperature
   * - 步级控制（toolChoice, stopWhen）由 prepareStep 处理
   */
  prepareCall: ({ options, ...settings }) => {
    const context = extractContextFromOptions(options);

    // 基于当前收集的信息构建 instructions
    const instructions = buildInterviewPrompt(context);

    return {
      ...settings,
      instructions,
      temperature: 0.7,
    };
  },

  /**
   * prepareStep: 步级控制
   * - 根据 stepNumber 和已收集信息动态调整 toolChoice 和 stopWhen
   * - 支持 researchTopic 和 designCurriculum 工具
   */
  prepareStep: ({ stepNumber, messages }) => {
    // 从消息历史提取上下文（支持 P0 后的消息历史状态）
    const context = extractContextFromMessages(messages);

    // 检测信息收集状态
    const hasGoal = Boolean(context.goal);
    const hasBackground = Boolean(context.background);
    const hasTargetOutcome = Boolean(context.targetOutcome);
    const hasCognitiveStyle = Boolean(context.cognitiveStyle);
    const hasAllInfo = hasGoal && hasBackground && hasTargetOutcome && hasCognitiveStyle;

    // Phase 4: 信息收集完毕 → 强制调用 designCurriculum，只执行 1 步
    if (hasAllInfo) {
      return {
        toolChoice: { type: "tool", toolName: "designCurriculum" },
        stopWhen: stepCountIs(1),
      };
    }

    // Phase 1: 首次交互（goal 为空）→ 让 AI 决定是否先研究领域
    if (stepNumber === 0 && !hasGoal) {
      // 不强制工具，让 AI 决定是先 researchTopic 还是 presentOptions
      return {
        stopWhen: stepCountIs(1),
      };
    }

    // 其他情况：让 AI 自由决策（可以调用 researchTopic、presentOptions 等）
    return {
      stopWhen: stepCountIs(1),
    };
  },
});

/**
 * 从消息历史中提取访谈上下文（P0 消息历史状态源）
 * 解析 presentOptions 的 tool result，重建用户选择
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
        // 跳过格式错误的 tool result
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
