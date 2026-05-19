/**
 * Chat Session API - Single Session Operations
 *
 * GET: 获取会话详情
 * DELETE: 删除会话
 */

import { parseBackgroundResearchMetadata } from "@/lib/ai/research/contracts";
import { badRequest, notFound, withDynamicAuth } from "@/lib/api";
import { revalidateConversationViews } from "@/lib/cache/domain-events";
import { loadConversationMessages } from "@/lib/chat/conversation-messages";
import { deleteOwnedConversation, getOwnedConversation } from "@/lib/chat/conversation-repository";
import { isUuidString } from "@/lib/chat/session-id";

export const GET = withDynamicAuth<unknown, { id: string }>(
  async (_request, { userId, params }) => {
    const { id } = params;

    if (!isUuidString(id)) {
      throw badRequest("Invalid session id", "INVALID_SESSION_ID");
    }

    const conv = await getOwnedConversation(id, userId);

    if (!conv) {
      throw notFound("Session not found", "SESSION_NOT_FOUND");
    }

    const messages = await loadConversationMessages(id);

    return Response.json({
      session: {
        ...conv,
        metadata: undefined,
        backgroundResearch: parseBackgroundResearchMetadata(conv.metadata),
        messages,
      },
    });
  },
);

export const DELETE = withDynamicAuth<unknown, { id: string }>(
  async (_request, { userId, params }) => {
    const { id } = params;

    if (!isUuidString(id)) {
      throw badRequest("Invalid session id", "INVALID_SESSION_ID");
    }

    const deleted = await deleteOwnedConversation(id, userId);
    if (!deleted) {
      throw notFound("Session not found", "SESSION_NOT_FOUND");
    }

    revalidateConversationViews(userId);

    return Response.json({ success: true });
  },
);
