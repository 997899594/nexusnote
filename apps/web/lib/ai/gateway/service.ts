import { v4 as uuidv4 } from "uuid";
import { isAIConfigured, chatModel } from "@/lib/ai/registry";
import { pruneUIMessages } from "@/lib/ai/ui-utils";
import { routeIntent } from "@/lib/ai/router/route";
import {
  interviewAgent,
  InterviewContextSchema,
  type InterviewContext,
} from "@/lib/ai/agents/interview/agent";
import { chatAgent } from "@/lib/ai/agents/chat-agent";
import {
  courseGenerationAgent,
  CourseGenerationContextSchema,
  type CourseGenerationContext,
} from "@/lib/ai/agents/course-generation/agent";
import { ragService } from "@/lib/ai/rag";
import { checkRateLimit } from "@/lib/ai/rate-limit";
import {
  createAgentUIStreamResponse,
  smoothStream,
  convertToModelMessages,
  type UIMessage,
} from "ai";
import { z } from "zod";

/**
 * 2026 架构师标准：统一 AI 上下文 Schema
 * 采用严格的联合类型，确保类型安全，杜绝 passthrough
 */
export const AIContextSchema = z.object({
  explicitIntent: z
    .enum(["INTERVIEW", "CHAT", "EDITOR", "SEARCH", "COURSE_GENERATION"])
    .optional(),
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

/**
 * AI 请求负载 Schema
 * 自动处理 useChat 可能发送的扁平化字段，并进行严格类型转换
 */
export const AIRequestSchema = z.preprocess(
  (val: any) => {
    // 架构师技巧：预处理扁平化 body，将其归位到 context 中
    if (val && typeof val === "object" && !val.context && val.messages) {
      const { messages, ...rest } = val;
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

/**
 * AIGatewayService - 系统核心 AI 调度服务
 */
export class AIGatewayService {
  static async handleRequest(
    input: AIRequest,
    options: AIGatewayOptions,
  ): Promise<Response> {
    const traceId = options.traceId || uuidv4();
    const { userId } = options;

    // 1. 验证 AI 配置
    if (!isAIConfigured()) {
      throw new Error("AI API key not configured");
    }

    // 2. 消息提取与优化
    const { messages, context = {} } = input;
    const modelMessages = await convertToModelMessages(messages);
    const lastUserMsg = modelMessages.filter((m) => m.role === "user").pop();
    let userInput = "";

    if (lastUserMsg && typeof lastUserMsg.content === "string") {
      userInput = lastUserMsg.content;
    } else if (lastUserMsg && Array.isArray(lastUserMsg.content)) {
      userInput = lastUserMsg.content
        .filter((p) => p.type === "text")
        .map((p) => (p.type === "text" ? p.text : ""))
        .join("");
    }

    const optimizedMessages = pruneUIMessages(messages, {
      reasoning: "none",
      toolCalls: "before-last-3-messages",
      emptyMessages: "remove",
    });

    // 3. 意图识别 (L0 路由)
    let intent = context.explicitIntent;
    if (!intent && userInput) {
      const routeResult = await routeIntent(
        userInput,
        JSON.stringify({
          isInInterview: context.isInInterview,
          hasDocumentOpen: context.hasDocumentOpen,
        }),
        traceId,
      );
      intent = routeResult.target as AIContext["explicitIntent"];
    }

    // 4. Agent 调度 (L2 路由)
    const smoothStreamConfig = smoothStream({
      delayInMs: 20,
      chunking: new Intl.Segmenter("zh-CN", { granularity: "grapheme" }),
    });

    switch (intent) {
      case "INTERVIEW": {
        return createAgentUIStreamResponse({
          agent: interviewAgent,
          uiMessages: optimizedMessages,
          options: { ...(context.interviewContext || {}), userId } as InterviewContext,
          experimental_transform: smoothStreamConfig,
        });
      }

      case "COURSE_GENERATION": {
        return createAgentUIStreamResponse({
          agent: courseGenerationAgent,
          uiMessages: optimizedMessages,
          options: { ...(context.courseGenerationContext || {}), userId } as CourseGenerationContext,
          experimental_transform: smoothStreamConfig,
        });
      }

      case "SEARCH": {
        return createAgentUIStreamResponse({
          agent: chatAgent,
          uiMessages: optimizedMessages,
          options: { enableWebSearch: true, enableTools: true },
          experimental_transform: smoothStreamConfig,
        });
      }

      case "EDITOR": {
        return createAgentUIStreamResponse({
          agent: chatAgent,
          uiMessages: optimizedMessages,
          options: {
            documentContext: context.documentContext,
            documentStructure: context.documentStructure,
            editMode: true,
            enableTools: true,
          },
          experimental_transform: smoothStreamConfig,
        });
      }

      case "CHAT":
      default: {
        let ragContext: string | undefined;
        if (context.enableRAG && userInput) {
          const ragResult = await ragService.search(userInput, userId);
          ragContext = ragResult.context;
        }

        return createAgentUIStreamResponse({
          agent: chatAgent,
          uiMessages: optimizedMessages,
          options: {
            ragContext,
            documentContext: context.documentContext,
            documentStructure: context.documentStructure,
            editMode: context.editMode,
            enableTools: context.enableTools,
            enableWebSearch: context.enableWebSearch,
          },
          experimental_transform: smoothStreamConfig,
        });
      }
    }
  }
}
