/**
 * Chat Session API - Single Session Operations
 *
 * GET: 获取会话详情
 * PATCH: 更新会话（标题、消息、归档状态）
 * DELETE: 删除会话
 */

import type { UIMessage } from "ai";
import { withDynamicAuth } from "@/lib/api";
import { revalidateProfileStats } from "@/lib/cache/tags";
import { loadConversationMessages } from "@/lib/chat/conversation-messages";
import { saveOwnedConversationSnapshot } from "@/lib/chat/conversation-persistence";
import {
  deleteOwnedConversation,
  getOwnedConversation,
  updateOwnedConversation,
} from "@/lib/chat/conversation-repository";
import { isUuidString } from "@/lib/chat/session-id";

interface UpdateSessionBody {
  title?: string;
  messages?: UIMessage[];
  summary?: string;
  isArchived?: boolean;
}

export const GET = withDynamicAuth<unknown, { id: string }>(
  async (_request, { userId, params }) => {
    const { id } = params;

    if (!isUuidString(id)) {
      return Response.json({ error: "Invalid session id" }, { status: 400 });
    }

    const conv = await getOwnedConversation(id, userId);

    if (!conv) {
      return Response.json({ error: "Session not found" }, { status: 404 });
    }

    const messages = await loadConversationMessages(id);

    return Response.json({ session: { ...conv, messages } });
  },
);

export const PATCH = withDynamicAuth<unknown, { id: string }>(
  async (request, { userId, params }) => {
    const { id } = params;

    if (!isUuidString(id)) {
      return Response.json({ error: "Invalid session id" }, { status: 400 });
    }

    const existing = await getOwnedConversation(id, userId);

    if (!existing) {
      return Response.json({ error: "Session not found" }, { status: 404 });
    }

    const body: UpdateSessionBody = await request.json();
    const { title, messages, summary, isArchived } = body;

    const updated =
      messages !== undefined
        ? await saveOwnedConversationSnapshot({
            conversationId: id,
            userId,
            existingSummary: existing.summary ?? null,
            messages,
            title,
            summary,
            isArchived,
            trimmedSummaryFallback: "较早的对话内容已折叠，仅保留最近消息。",
          })
        : await (async () => {
            const conversation = await updateOwnedConversation({
              conversationId: id,
              userId,
              updates: {
                ...(title !== undefined && { title }),
                ...(summary !== undefined && { summary }),
                ...(isArchived !== undefined && { isArchived }),
                updatedAt: new Date(),
              },
            });

            if (!conversation) {
              return null;
            }

            const persistedMessages = await loadConversationMessages(id);
            return {
              conversation,
              messages: persistedMessages,
            };
          })();

    if (!updated) {
      return Response.json({ error: "Session not found" }, { status: 404 });
    }

    revalidateProfileStats(userId);

    return Response.json({
      session: { ...updated.conversation, messages: updated.messages },
    });
  },
);

export const DELETE = withDynamicAuth<unknown, { id: string }>(
  async (_request, { userId, params }) => {
    const { id } = params;

    if (!isUuidString(id)) {
      return Response.json({ error: "Invalid session id" }, { status: 400 });
    }

    const deleted = await deleteOwnedConversation(id, userId);
    if (!deleted) {
      return Response.json({ error: "Session not found" }, { status: 404 });
    }

    revalidateProfileStats(userId);

    return Response.json({ success: true });
  },
);
