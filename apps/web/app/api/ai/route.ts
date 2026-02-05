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
import { ragService } from "@/lib/ai/rag";
import { createAgentUIStreamResponse, smoothStream } from "ai";

export const runtime = "nodejs";
export const maxDuration = 60;

interface RequestBody {
  messages: any[];
  context?: {
    // 显式意图（绕过 Router）
    explicitIntent?: "INTERVIEW" | "CHAT" | "EDITOR" | "SEARCH";

    // Interview 上下文
    interviewContext?: {
      goal?: string;
      background?: string;
      targetOutcome?: string;
      cognitiveStyle?: string;
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
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. AI 配置检查
  if (!isAIConfigured()) {
    const info = getAIProviderInfo();
    return Response.json(
      { error: `AI API key not configured. Provider: ${info.provider}` },
      { status: 500 },
    );
  }
  console.log("-----> HIT DEBUGGER POINT <-----");
  console.log("Request Body:", await req.clone().json());
  // 3. 解析请求
  const body: RequestBody = await req.json();
  const { messages, context = {} } = body;

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
    // 4. L0: 路由决策
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

    // 5. L2: Agent 调度
    switch (intent) {
      case "INTERVIEW": {
        console.log("[AI Gateway] Dispatching to Interview Agent");
        console.log(
          "[AI Gateway] Interview context:",
          JSON.stringify(context.interviewContext),
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
            options: context.interviewContext || {},
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

      case "CHAT":
      default: {
        console.log("[AI Gateway] Dispatching to Chat Agent");

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
          uiMessages: messages,
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
