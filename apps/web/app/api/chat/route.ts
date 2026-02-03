import { streamText, convertToModelMessages } from "ai";
import {
  isAIConfigured,
  getAIProviderInfo,
  chatModel,
  webSearchModel,
} from "@/lib/ai/registry";
import {
  chatTools,
  buildInstructions,
  type ChatCallOptions,
} from "@/lib/ai/agents/chat-agent";
import { ragService } from "@/lib/ai/rag";
import { auth } from "@/auth";
import { routeIntent } from "@/lib/ai/router/route";
import { createInterviewAgent } from "@/lib/ai/agents/interview/agent";
import { createTelemetryConfig } from "@/lib/ai/langfuse";

export const runtime = "nodejs";
export const maxDuration = 60;

interface MessagePart {
  type: string;
  text?: string;
  [key: string]: unknown;
}

interface ChatMessage {
  role: string;
  parts?: MessagePart[];
  content?: string; // Add content support for standard messages
  [key: string]: unknown;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const {
    messages,
    enableRAG = false,
    enableTools = true,
    enableWebSearch = false,
    documentContext,
    documentStructure,
    editMode = false,
  } = await req.json();

  if (!isAIConfigured()) {
    const info = getAIProviderInfo();
    return Response.json(
      { error: `AI API key not configured. Provider: ${info.provider}` },
      { status: 500 },
    );
  }

  // Extract User Input
  const lastUserMsg = (messages as ChatMessage[])
    .filter((m) => m.role === "user")
    .pop();

  let query = "";
  if (lastUserMsg?.content) {
    query = lastUserMsg.content;
  } else if (lastUserMsg?.parts) {
    query =
      lastUserMsg.parts
        .filter((p) => p.type === "text")
        .map((p) => p.text)
        .join("") || "";
  }

  // =========================================================
  // ROUTING LOGIC (2026 Architecture)
  // =========================================================
  //
  // Note: Interview now has a dedicated API endpoint at /api/learn/interview
  // This chat route focuses on general conversation and RAG-based assistance
  //
  // Optional: If you want automatic interview triggering from chat, uncomment below
  /*
  let intent = "CHAT";
  if (query) {
    try {
      const routing = await routeIntent(query, "");
      if (routing.target === "INTERVIEW") {
        const agent = createInterviewAgent({});
        const result = await agent.stream({ messages });
        return result.toUIMessageStreamResponse();
      }
    } catch (e) {
      console.error("Routing failed, defaulting to CHAT", e);
    }
  }
  */

  // Default: CHAT AGENT (RAG-powered conversation)

  // RAG 上下文预获取
  let ragContext: string | undefined;

  let ragSources: Array<{ documentId: string; title: string }> | undefined;

  if (enableRAG) {
    if (query) {
      const result = await ragService.search(query, session.user!.id!);
      ragContext = result.context;
      ragSources = result.sources;
    }
  }

  // 构造 callOptions，传给 Agent 的 prepareCall
  const callOptions: ChatCallOptions = {
    ragContext,
    ragSources,
    documentContext,
    documentStructure,
    editMode,
    enableTools,
    enableWebSearch,
  };

  // 选择 Agent：启用联网搜索时使用 webSearchModel
  const model = enableWebSearch && webSearchModel ? webSearchModel : chatModel;

  // Use Vercel AI SDK v6 streamText
  try {
    if (!model) {
      throw new Error("AI model not configured");
    }

    // AI SDK v6 streamText with Langfuse Telemetry
    const result = streamText({
      model: model!,
      messages: await convertToModelMessages(messages),
      tools: enableTools ? chatTools : undefined,
      system: buildInstructions(callOptions),
      temperature: 0.7, // 🔥 升温，让对话更自然、更有同理心
      // AI SDK v6 Native Features (2026)
      maxRetries: 3,
      onFinish: ({ usage, finishReason, toolCalls }) => {
        if (usage?.totalTokens) {
          const cost = (usage.totalTokens / 1000000) * 0.1;
          console.log(
            `[Chat] Tokens: ${usage.totalTokens}, Cost: $${cost.toFixed(4)}, Tools: ${toolCalls?.length || 0}, Reason: ${finishReason}`,
          );
        }
      },
      // Langfuse Observability (2026)
      experimental_telemetry: createTelemetryConfig("chat-agent", {
        userId: session.user?.id || "anonymous",
        enableRAG: enableRAG,
        enableTools: enableTools,
        enableWebSearch: enableWebSearch,
      }),
    });

    return result.toUIMessageStreamResponse();
  } catch (err) {
    console.error("[Chat] Agent error:", err);
    return Response.json({ error: "AI 响应失败，请重试" }, { status: 500 });
  }
}
