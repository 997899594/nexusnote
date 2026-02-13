/**
 * AI Gateway Service — 统一 AI 调度入口
 *
 * 2026 架构：使用 Pipeline 模式替代 God Method
 * handleRequest 现在只负责构建初始 context，然后交给 pipeline 处理
 */

import type { UIMessage } from "ai";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { CourseGenerationContextSchema } from "@/features/learning/agents/course-generation/agent";
import { InterviewContextSchema } from "@/features/learning/agents/interview/agent";
import { defaultPipeline } from "../pipeline";
import type { PipelineContext } from "../pipeline/types";

// ============================================
// Schema 定义
// ============================================

export const AIContextSchema = z.object({
  explicitIntent: z.enum(["INTERVIEW", "CHAT", "EDITOR", "SEARCH", "COURSE_GENERATION"]).optional(),
  interviewContext: InterviewContextSchema.optional(),
  courseGenerationContext: CourseGenerationContextSchema.optional(),
  enableRAG: z.boolean().optional(),
  enableWebSearch: z.boolean().optional(),
  documentContext: z.string().optional(),
  documentStructure: z.string().optional(),
  editMode: z.boolean().optional(),
  enableTools: z.boolean().optional(),
  isInInterview: z.boolean().optional(),
  hasDocumentOpen: z.boolean().optional(),
  hasSelection: z.boolean().optional(),
});

export type AIContext = z.infer<typeof AIContextSchema>;

export const AIRequestSchema = z.preprocess(
  (val: unknown) => {
    if (val && typeof val === "object" && !("context" in val) && "messages" in val) {
      const { messages, ...rest } = val as Record<string, unknown>;
      return { messages, context: rest };
    }
    return val;
  },
  z.object({
    messages: z.array(z.custom<UIMessage>()),
    context: AIContextSchema.optional(),
  }),
);

export type AIRequest = z.infer<typeof AIRequestSchema>;

export interface AIGatewayOptions {
  userId: string;
  traceId?: string;
}

// ============================================
// Gateway Service
// ============================================

export class AIGatewayService {
  /**
   * 处理 AI 请求 — 构建初始 context 并交给 pipeline
   */
  static async handleRequest(input: AIRequest, options: AIGatewayOptions): Promise<Response> {
    const initial: PipelineContext = {
      rawMessages: input.messages,
      context: input.context || {},
      userId: options.userId,
      traceId: options.traceId || uuidv4(),
    };

    return defaultPipeline.execute(initial);
  }
}
