/**
 * Course Generation Agent - NexusNote 2026
 * 根据课程大纲生成实际的课程章节内容
 *
 * 架构特性：
 * 1. ToolLoopAgent + Registry 中的 extractReasoningMiddleware - 显示 AI 的思考过程
 * 2. smoothStream 由后端处理 - 中文逐字流式输出（Intl.Segmenter）
 * 3. 工具调用（saveChapterContent）由后端 Agent 执行 - 前端无需干预
 * 4. 前端通过 useChat 接收实时流式文本，直接投送到 Tiptap
 *
 * 设计哲学：
 * - Registry 统一管理模型和中间件配置
 * - SDK 处理复杂流程（流式、分块、推理中间件）
 * - 前端只负责接收文本和渲染
 * - 数据持久化由后端工具完成
 * - AI 的推理过程显示给用户（thinking 标签）
 */

import { ToolLoopAgent, InferAgentUIMessage, stepCountIs, type ToolSet } from "ai";
import { z } from "zod";
import { chatModel } from "@/lib/ai/registry";
import { courseGenerationTools } from "@/lib/ai/tools/course-generation";
import { buildCourseGenerationPrompt } from "@/lib/ai/prompts/course-generation";
import { OutlineSchema } from "@/lib/ai/profile/course-profile";

/**
 * Course Generation Context Schema
 * 维护生成过程的状态
 */
export const CourseGenerationContextSchema = z.object({
  id: z.string().uuid().describe("课程 ID"),
  userId: z.string().uuid().describe("用户 ID"),

  // 课程基本信息
  goal: z.string().describe("学习目标"),
  background: z.string().describe("学习背景"),
  targetOutcome: z.string().describe("预期成果"),
  cognitiveStyle: z.string().describe("学习风格"),

  // 大纲信息
  outlineTitle: z.string().describe("课程标题"),
  outlineData: OutlineSchema.optional().describe("完整的课程大纲数据"),
  moduleCount: z.number().describe("总模块数"),
  totalChapters: z.number().describe("总章节数"),

  // 生成进度
  currentModuleIndex: z.number().default(0).describe("当前模块索引"),
  currentChapterIndex: z.number().default(0).describe("当前章节索引"),
  chaptersGenerated: z.number().default(0).describe("已生成的章节数"),
});

export type CourseGenerationContext = z.infer<
  typeof CourseGenerationContextSchema
>;

/**
 * Course Generation Agent
 * 负责生成课程的实际内容
 *
 * 与 Interview Agent 保持一致的架构：
 * - chatModel 已在 registry 中应用了 extractReasoningMiddleware
 * - 多步推理支持自主决策工具调用
 * - 完整的类型安全和可观测性
 */
export const courseGenerationAgent = new ToolLoopAgent({
  id: "nexusnote-course-generation",
  model: chatModel!, // 已包含 extractReasoningMiddleware
  tools: courseGenerationTools,
  maxOutputTokens: 8192,
  callOptionsSchema: CourseGenerationContextSchema,

  /**
   * prepareCall: 核心逻辑
   * 在每次 AI 调用前，动态构建 instructions 和策略
   * 根据生成进度调整，确保逐步生成直到完成
   */
  prepareCall: ({ options, ...rest }) => {
    const context = (options ?? {}) as CourseGenerationContext;

    console.log("[Course Generation Agent] prepareCall with context:", context);

    // 动态构建 System Prompt
    const instructions = buildCourseGenerationPrompt(context);

    console.log(
      "[Course Generation Agent] Generated instructions (first 500 chars):",
      instructions.slice(0, 500),
    );

    // 检查生成进度
    const isComplete = context.chaptersGenerated >= context.totalChapters;

    console.log("[Course Generation Agent] Generation status:", {
      totalChapters: context.totalChapters,
      chaptersGenerated: context.chaptersGenerated,
      isComplete,
    });

    if (isComplete) {
      console.log("[Course Generation Agent] ✅ Generation complete");
      return {
        ...rest,
        instructions:
          "所有章节已生成完毕。请总结课程亮点，并鼓励学生开始学习。",
        stopWhen: stepCountIs(1),
      };
    }

    return {
      ...rest,
      instructions,
      stopWhen: ({ steps }) => {
        // 当 AI 调用了保存章节或标记完成的工具后，立即停止
        const lastStep = steps[steps.length - 1];
        return (
          lastStep.toolCalls?.some(
            (tc) =>
              tc.toolName === "saveChapterContent" ||
              tc.toolName === "markGenerationComplete",
          ) ?? false
        );
      },
    };
  },
});

/**
 * 导出类型：客户端 useChat 泛型参数
 */
export type CourseGenerationAgentMessage = InferAgentUIMessage<
  typeof courseGenerationAgent
>;
