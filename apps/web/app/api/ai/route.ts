/**
 * Unified AI API Gateway - NexusNote 2026 Architecture
 *
 * 这是所有 AI 交互的统一入口
 * 实现 L0 路由 + L2 Agent 调度
 *
 * 架构：
 * 1. L0 Router: 意图分类（Interview/Chat/Editor）
 * 2. L2 Agents: 调度对应的 Agent
 * 3. Streaming: 统一返回 UI Message Stream
 */

import { auth } from "@/auth";
import { isAIConfigured, getAIProviderInfo } from "@/lib/ai/registry";
import { routeIntent } from "@/lib/ai/router/route";
import { interviewAgent } from "@/lib/ai/agents/interview/agent";
import { chatAgent, webSearchChatAgent } from "@/lib/ai/agents/chat-agent";
import { courseGenerationAgent } from "@/lib/ai/agents/course-generation/agent";
import { ragService } from "@/lib/ai/rag";
import {
  checkRateLimit,
  createRateLimitResponse,
  trackAIUsage,
} from "@/lib/ai/rate-limit";
import {
  createAgentUIStreamResponse,
  smoothStream,
  pruneMessages,
  convertToModelMessages,
} from "ai";

export const runtime = "nodejs";
export const maxDuration = 60;

interface RequestBody {
  messages: any[];
  context?: {
    // 显式意图（绕过 Router）
    explicitIntent?:
      | "INTERVIEW"
      | "CHAT"
      | "EDITOR"
      | "SEARCH"
      | "COURSE_GENERATION";

    // Interview 上下文
    interviewContext?: {
      goal?: string;
      background?: string;
      targetOutcome?: string;
      cognitiveStyle?: string;
    };

    // Course Generation 上下文
    courseGenerationContext?: {
      id?: string;
      userId?: string;
      goal?: string;
      background?: string;
      targetOutcome?: string;
      cognitiveStyle?: string;
      outlineTitle?: string;
      outlineData?: any;
      moduleCount?: number;
      totalChapters?: number;
      currentModuleIndex?: number;
      currentChapterIndex?: number;
      chaptersGenerated?: number;
    };

    // Chat 上下文
    enableRAG?: boolean;
    enableWebSearch?: boolean;
    documentContext?: string;
    documentStructure?: string;
    editMode?: boolean;
    enableTools?: boolean;

    // Router 上下文
    isInInterview?: boolean;
    hasDocumentOpen?: boolean;
    hasSelection?: boolean;
  };
}

export async function POST(req: Request) {
  // 1. 认证检查
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. 速率限制检查
  const rateLimitResult = await checkRateLimit(session.user.id);
  if (!rateLimitResult.allowed) {
    return createRateLimitResponse(rateLimitResult.resetAt);
  }

  // 4. AI 配置检查
  if (!isAIConfigured()) {
    const info = getAIProviderInfo();
    return Response.json(
      { error: `AI API key not configured. Provider: ${info.provider}` },
      { status: 500 },
    );
  }

  // 5. 解析请求
  const body: RequestBody = await req.json();
  const { messages, context: rawContext = {} } = body;

  // SDK v6 的 context 可能会嵌套在 options.body 中，或者直接在 root
  // 这里的解析逻辑需要兼容不同的调用方式
  const context = (rawContext as any).body?.context || rawContext;

  // 提取用户输入（用于路由）
  const lastUserMsg = messages.filter((m: any) => m.role === "user").pop();
  let userInput = "";
  if (lastUserMsg?.content) {
    userInput = lastUserMsg.content;
  } else if (lastUserMsg?.parts) {
    userInput = lastUserMsg.parts
      .filter((p: any) => p.type === "text")
      .map((p: any) => p.text)
      .join("");
  }

  try {
    // 6. L0: 路由决策
    let intent = context.explicitIntent;

    if (!intent && userInput) {
      // 使用 Router 进行语义分类
      const routeResult = await routeIntent(
        userInput,
        JSON.stringify({
          isInInterview: context.isInInterview,
          hasDocumentOpen: context.hasDocumentOpen,
        }),
      );
      intent = routeResult.target;

      console.log("[AI Gateway] Router decision:", {
        input: userInput.slice(0, 50),
        intent,
        confidence: routeResult.reasoning,
      });
    }

    // 7. L2: Agent 调度
    switch (intent) {
      case "INTERVIEW": {
        console.log("[AI Gateway] Dispatching to Interview Agent");

        // Interview Agent options - 加入 userId（用于保存课程画像）
        const interviewOptions = {
          ...context.interviewContext,
          userId: session.user?.id, // 用户 ID（后续保存课程画像时使用）
        };

        console.log(
          "[AI Gateway] Interview context:",
          JSON.stringify(interviewOptions),
        );
        console.log(
          "[AI Gateway] Interview Agent tools:",
          Object.keys(interviewAgent.tools),
        );
        console.log("[AI Gateway] Messages count:", messages.length);

        try {
          const response = createAgentUIStreamResponse({
            agent: interviewAgent,
            uiMessages: messages,
            options: interviewOptions,
            // maxSteps 参数不被支持，已移除
            experimental_transform: smoothStream({
              delayInMs: 30,
              chunking: new Intl.Segmenter("zh-CN", {
                granularity: "grapheme",
              }),
            }),
            onError: (error) => {
              console.error("[AI Gateway] Stream error:", error);
              return "发生了一个错误，请稍后重试。";
            },
          });
          return response;
        } catch (error) {
          console.error("[AI Gateway] Failed to create response:", error);
          return Response.json(
            {
              error: "Agent 响应失败",
              details: error instanceof Error ? error.message : String(error),
            },
            { status: 500 },
          );
        }
      }

      case "SEARCH": {
        console.log("[AI Gateway] Dispatching to Chat Agent (Web Search mode)");

        const searchAgent = webSearchChatAgent || chatAgent;

        return createAgentUIStreamResponse({
          agent: searchAgent,
          uiMessages: messages,
          options: {
            enableWebSearch: true,
            enableTools: true,
          },
          // maxSteps 参数不被支持，已移除
          experimental_transform: smoothStream({
            delayInMs: 30,
            chunking: new Intl.Segmenter("zh-CN", { granularity: "grapheme" }),
          }),
        });
      }

      case "EDITOR": {
        console.log("[AI Gateway] Dispatching to Chat Agent (Edit mode)");

        return createAgentUIStreamResponse({
          agent: chatAgent,
          uiMessages: messages,
          options: {
            documentContext: context.documentContext,
            documentStructure: context.documentStructure,
            editMode: true,
            enableTools: true,
          },
          // maxSteps 参数不被支持，已移除
          experimental_transform: smoothStream({
            delayInMs: 30,
            chunking: new Intl.Segmenter("zh-CN", { granularity: "grapheme" }),
          }),
        });
      }

      case "COURSE_GENERATION": {
        console.log("[AI Gateway] Dispatching to Course Generation Agent");

        const courseGenerationOptions = {
          ...context.courseGenerationContext,
          id: context.courseGenerationContext?.id || "",
          userId:
            context.courseGenerationContext?.userId || session.user?.id || "",
          goal: context.courseGenerationContext?.goal || "",
          background: context.courseGenerationContext?.background || "",
          targetOutcome: context.courseGenerationContext?.targetOutcome || "",
          cognitiveStyle: context.courseGenerationContext?.cognitiveStyle || "",
          outlineTitle: context.courseGenerationContext?.outlineTitle || "",
          outlineData:
            context.courseGenerationContext?.outlineData || undefined,
          moduleCount: context.courseGenerationContext?.moduleCount || 0,
          totalChapters: context.courseGenerationContext?.totalChapters || 0,
          currentModuleIndex:
            context.courseGenerationContext?.currentModuleIndex || 0,
          currentChapterIndex:
            context.courseGenerationContext?.currentChapterIndex || 0,
          chaptersGenerated:
            context.courseGenerationContext?.chaptersGenerated || 0,
        };

        console.log(
          "[AI Gateway] Course Generation context:",
          JSON.stringify(courseGenerationOptions),
        );

        try {
          const response = createAgentUIStreamResponse({
            agent: courseGenerationAgent,
            uiMessages: messages,
            options: courseGenerationOptions,
            experimental_transform: smoothStream({
              delayInMs: 30,
              chunking: new Intl.Segmenter("zh-CN", {
                granularity: "grapheme",
              }),
            }),
            onError: (error) => {
              console.error("[AI Gateway] Course Generation error:", error);
              return "课程生成失败，请重试。";
            },
          });
          return response;
        } catch (error) {
          console.error(
            "[AI Gateway] Failed to create course generation response:",
            error,
          );
          return Response.json(
            {
              error: "课程生成失败",
              details: error instanceof Error ? error.message : String(error),
            },
            { status: 500 },
          );
        }
      }

      case "CHAT":
      default: {
        console.log("[AI Gateway] Dispatching to Chat Agent");

        // 优化：使用 pruneMessages 修剪历史消息，节省 token
        // - 移除推理过程（Chat 对话不需要显示）
        // - 只保留最近 3 条消息的工具调用记录
        // - 删除空消息
        const modelMessages = await convertToModelMessages(messages);
        const optimizedMessages = pruneMessages({
          messages: modelMessages,
          reasoning: "none", // Chat 不需要显示推理，移除以节省 token
          toolCalls: "before-last-3-messages", // 只保留最近 3 条的工具调用
          emptyMessages: "remove",
        });

        // RAG 预检索
        let ragContext: string | undefined;
        let ragSources:
          | Array<{ documentId: string; title: string }>
          | undefined;

        if (context.enableRAG && userInput) {
          const ragResult = await ragService.search(
            userInput,
            session.user!.id!,
          );
          ragContext = ragResult.context;
          ragSources = ragResult.sources;
        }

        // 选择 Agent（联网搜索 vs 普通对话）
        const agent =
          context.enableWebSearch && webSearchChatAgent
            ? webSearchChatAgent
            : chatAgent;

        return createAgentUIStreamResponse({
          agent,
          uiMessages: optimizedMessages, // 使用优化后的消息
          options: {
            ragContext,
            ragSources,
            documentContext: context.documentContext,
            documentStructure: context.documentStructure,
            editMode: context.editMode,
            enableTools: context.enableTools,
            enableWebSearch: context.enableWebSearch,
          },
          // maxSteps 参数不被支持，已移除
          experimental_transform: smoothStream({
            delayInMs: 30,
            chunking: new Intl.Segmenter("zh-CN", { granularity: "grapheme" }),
          }),
        });
      }
    }
  } catch (error) {
    console.error("[AI Gateway] Error:", error);
    return Response.json(
      {
        error: "AI 响应失败，请重试",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
