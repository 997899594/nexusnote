import { runInterview } from "@/lib/ai/agents/interview/agent";
import { isAIConfigured, getAIProviderInfo } from "@/lib/ai/registry";
import { auth } from "@/auth";
import { convertToModelMessages } from "ai";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Modern Interview API (2026) - Agentic Workflow
 *
 * 架构：
 * - ✅ streamText with Tools
 * - ✅ Multi-step reasoning (AI decides when to call tools)
 * - ✅ Standard Data Stream Protocol (supports text + tool calls)
 */

export async function POST(req: Request) {
  const session = await auth();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { messages, interviewContext = {} } = await req.json();

  if (!isAIConfigured()) {
    const info = getAIProviderInfo();
    return Response.json(
      { error: `AI API key not configured. Provider: ${info.provider}` },
      { status: 500 },
    );
  }

  try {
    // Run interview agent (streamText + Tools)
    // IMPORTANT: Convert UI messages to ModelMessages for AI SDK v6
    const coreMessages = await convertToModelMessages(messages);
    const result = await runInterview(coreMessages, interviewContext);

    // Return standard data stream (supports text parts and tool call parts)
    // IMPORTANT: .toDataStreamResponse() is the standard for useChat + Tools
    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("[Interview API] Error:", error);
    return Response.json(
      {
        error: "Failed to generate interview response",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
