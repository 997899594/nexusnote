/**
 * Chat Session Index API - Conversation Indexing
 *
 * POST: Trigger indexing of a chat conversation for RAG search
 *
 * This endpoint chunks conversation messages and stores them in the knowledge base
 * with embeddings for semantic search.
 */

import type { UIMessage } from "ai";
import { withAuth } from "@/lib/api";
import { syncConversationKnowledge } from "@/lib/chat/conversation-knowledge";
import { getOwnedConversation } from "@/lib/chat/conversation-repository";
import { isUuidString } from "@/lib/chat/session-id";

interface IndexSessionBody {
  sessionId: string;
  messages: UIMessage[];
}

export const POST = withAuth(async (request, { userId }) => {
  const body: IndexSessionBody = await request.json();
  const { sessionId, messages } = body;

  // Validate sessionId
  if (!isUuidString(sessionId)) {
    return Response.json({ error: "Invalid sessionId" }, { status: 400 });
  }

  // Verify session exists and belongs to user
  const conversation = await getOwnedConversation(sessionId, userId);

  if (!conversation) {
    return Response.json({ error: "Session not found" }, { status: 404 });
  }

  // Validate messages array
  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: "Invalid messages array" }, { status: 400 });
  }

  await syncConversationKnowledge({
    conversationId: sessionId,
    userId,
    messages,
  });

  return Response.json({
    success: true,
    sessionId,
  });
});
