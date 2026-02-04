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

import { ToolLoopAgent, InferAgentUIMessage, stepCountIs } from 'ai';
import { z } from 'zod';
import { chatModel } from '@/lib/ai/registry';
import { interviewTools } from '@/lib/ai/tools/interview';
import { buildInterviewPrompt, type InterviewContext } from '@/lib/ai/prompts/interview';

/**
 * 调用选项 Schema
 * 这会被验证并传递给 prepareCall
 */
const InterviewCallOptionsSchema = z.object({
  goal: z.string().optional(),
  background: z.string().optional(),
  time: z.string().optional(),
  targetOutcome: z.string().optional(),
  cognitiveStyle: z.string().optional(),
  level: z.string().optional(),
  levelDescription: z.string().optional(),
});

export type InterviewCallOptions = z.infer<typeof InterviewCallOptionsSchema>;

/**
 * Interview Agent 定义
 *
 * 与 Chat Agent 保持一致的架构模式
 */
export const interviewAgent = new ToolLoopAgent({
  id: 'nexusnote-interview',
  model: chatModel!,
  tools: interviewTools,
  maxOutputTokens: 4096,
  callOptionsSchema: InterviewCallOptionsSchema,

  /**
   * prepareCall: 核心逻辑
   * 在每次 AI 调用前，动态构建 instructions
   */
  prepareCall: ({ options, ...rest }) => {
    const callOptions = (options ?? {}) as InterviewCallOptions;

    console.log('[Interview Agent] prepareCall called with options:', callOptions);

    // L1: 动态构建 System Prompt
    // 这里是"代码控流"的关键：根据数据缺口注入不同的指令
    const instructions = buildInterviewPrompt(callOptions);

    console.log('[Interview Agent] Generated instructions (first 500 chars):', instructions.slice(0, 500));
    console.log('[Interview Agent] Tools available:', Object.keys(interviewTools));

    // 检测当前阶段
    const hasGoal = Boolean(callOptions.goal);
    const hasBackground = Boolean(callOptions.background);
    const hasTime = Boolean(callOptions.time);
    const hasAllInfo = hasGoal && hasBackground && hasTime;

    console.log('[Interview Agent] Phase detection:', { hasGoal, hasBackground, hasTime, hasAllInfo });

    // Phase 4: 信息收集完毕，强制调用 generateOutline
    if (hasAllInfo) {
      console.log('[Interview Agent] ✅ All info collected, FORCING generateOutline');
      return {
        ...rest,
        instructions,
        temperature: 0.8,
        toolChoice: { type: 'tool', toolName: 'generateOutline' },
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
 * 重新导出 Context 类型供外部使用
 */
export type { InterviewContext } from '@/lib/ai/prompts/interview';
