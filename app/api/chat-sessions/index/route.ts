/**
 * Chat Session Index API - Conversation Indexing
 *
 * POST: Trigger indexing of a chat conversation for RAG search
 *
 * This endpoint chunks conversation messages and stores them in the knowledge base
 * with embeddings for semantic search.
 */

import type { UIMessage } from "ai";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { conversations, db, eq } from "@/db";
import { indexConversation } from "@/lib/rag/chunker";
import { conversationToParagraphs } from "@/lib/rag/semantic-chunker";
import { authOptions } from "../../auth/[...nextauth]/route";

interface IndexSessionBody {
  sessionId: string;
  messages: UIMessage[];
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: IndexSessionBody = await request.json();
    const { sessionId, messages } = body;

    // Validate sessionId
    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json({ error: "Invalid sessionId" }, { status: 400 });
    }

    // Verify session exists and belongs to user
    const [conversation] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, sessionId))
      .limit(1);

    if (!conversation) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (conversation.userId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Validate messages array
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Invalid messages array" }, { status: 400 });
    }

    // Convert UIMessage to simple format for indexing
    // UIMessage has parts array with text parts
    const simpleMessages = messages.map((msg) => ({
      role: msg.role,
      content: extractTextFromParts(msg.parts),
    }));

    function extractTextFromParts(parts: UIMessage["parts"]): string {
      if (!parts || !Array.isArray(parts)) return "";
      return parts
        .filter((p) => p?.type === "text")
        .map((p) => (p && "text" in p ? p.text : ""))
        .join("\n");
    }

    // Convert conversation to paragraphs for better indexing
    const paragraphs = conversationToParagraphs(simpleMessages);
    const plainText = paragraphs.join("\n\n");

    // Trigger indexing (runs synchronously for now, can be moved to queue later)
    const result = await indexConversation(sessionId, plainText, userId, {
      metadata: {
        messageCount: messages.length,
        title: conversation.title,
        intent: conversation.intent,
        indexedAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      chunksIndexed: result.chunksCount,
      sessionId,
    });
  } catch (error) {
    console.error("[ChatSessionIndex] POST error:", error);
    return NextResponse.json({ error: "Failed to index session" }, { status: 500 });
  }
}
