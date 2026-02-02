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
import {
  runInterviewStep,
  InterviewContext,
} from "@/lib/ai/agents/interview/machine";
import { InterviewState } from "@/lib/ai/agents/interview/schema";

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
    // New params
    interviewState = "IDLE" as InterviewState,
    interviewContext = {} as InterviewContext,
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

  let intent = "CHAT";

  // 1. If inside an interview loop, stay in it
  if (
    interviewState !== "IDLE" &&
    interviewState !== "COMPLETED" &&
    interviewState !== "GENERATING"
  ) {
    intent = "INTERVIEW";
  }
  // 2. Otherwise, check with Router
  else if (query) {
    try {
      const routing = await routeIntent(
        query,
        `Current State: ${interviewState}`,
      );
      // If router says INTERVIEW, switch to it
      if (routing.target === "INTERVIEW") {
        intent = "INTERVIEW";
      }
      // If router says SEARCH, enable web search for Chat Agent
      if (routing.target === "SEARCH") {
        // Modify the request effectively
        // But we handle this via dispatch below
      }
    } catch (e) {
      console.error("Routing failed, defaulting to CHAT", e);
    }
  }

  // =========================================================
  // DISPATCH
  // =========================================================

  if (intent === "INTERVIEW") {
    try {
      const stepResult = await runInterviewStep(
        interviewState,
        query,
        interviewContext,
      );

      // Return the stream with State headers
      const response = stepResult.stream;
      response.headers.set("X-Nexus-Interview-State", stepResult.nextState);
      response.headers.set(
        "X-Nexus-Interview-Context",
        JSON.stringify(stepResult.contextUpdates),
      );
      // Mark as standard stream (Hybrid Text + Tools)
      // response.headers.set("X-Nexus-Stream-Type", "object"); // REMOVED: Back to standard stream

      return response;
    } catch (err) {
      console.error("Interview Error:", err);
      return Response.json(
        { error: "Interview Logic Failed" },
        { status: 500 },
      );
    }
  }

  // Default: CHAT AGENT (Legacy + RAG)

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

    const result = streamText({
      model: model,
      messages: await convertToModelMessages(messages),
      tools: enableTools ? chatTools : undefined,
      system: buildInstructions(callOptions),
      temperature: 0.7, // 🔥 升温，让对话更自然、更有同理心
    });

    return result.toTextStreamResponse();
  } catch (err) {
    console.error("[Chat] Agent error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: `Chat failed: ${message}` }, { status: 500 });
  }
}
