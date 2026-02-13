/**
 * select-agent stage — 根据意图选择 Agent + 构建调用选项
 *
 * 将 switch/case 逻辑从 Gateway 拆出，集中管理 Agent 映射
 */

import { chatAgent } from "@/features/chat/agents/chat-agent";
import {
  type CourseGenerationContext,
  courseGenerationAgent,
} from "@/features/learning/agents/course-generation/agent";
import {
  type InterviewContext,
  interviewAgent,
} from "@/features/learning/agents/interview/agent";
import type { PipelineContext, PipelineStage } from "../types";

export const selectAgentStage: PipelineStage = {
  name: "select-agent",
  async execute(ctx) {
    switch (ctx.intent) {
      case "INTERVIEW":
        return {
          ...ctx,
          agent: interviewAgent,
          agentOptions: {
            ...(ctx.context.interviewContext || {}),
            userId: ctx.userId,
          } as InterviewContext,
        };

      case "COURSE_GENERATION":
        return {
          ...ctx,
          agent: courseGenerationAgent,
          agentOptions: {
            ...(ctx.context.courseGenerationContext || {}),
            userId: ctx.userId,
          } as CourseGenerationContext,
        };

      case "SEARCH":
        return {
          ...ctx,
          agent: chatAgent,
          agentOptions: { enableWebSearch: true, enableTools: true },
        };

      case "EDITOR":
        return {
          ...ctx,
          agent: chatAgent,
          agentOptions: {
            documentContext: ctx.context.documentContext,
            documentStructure: ctx.context.documentStructure,
            editMode: true,
            enableTools: true,
          },
        };

      default:
        return {
          ...ctx,
          agent: chatAgent,
          agentOptions: {
            ragContext: ctx.ragContext,
            documentContext: ctx.context.documentContext,
            documentStructure: ctx.context.documentStructure,
            editMode: ctx.context.editMode,
            enableTools: ctx.context.enableTools,
            enableWebSearch: ctx.context.enableWebSearch,
          },
        };
    }
  },
};
