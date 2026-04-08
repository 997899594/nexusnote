import { UI_MESSAGE_STREAM_HEADERS } from "ai";
import { after } from "next/server";
import { conversations, db, eq } from "@/db";
import { getChatResumableStreamContext } from "@/lib/ai";
import { withDynamicAuth } from "@/lib/api";
import { getConversationActiveStreamId } from "@/lib/chat/conversation-persistence";
import { isUuidString } from "@/lib/chat/session-id";

export const GET = withDynamicAuth<unknown, { id: string }>(
  async (_request, { userId, params }) => {
    const { id } = params;

    if (!isUuidString(id)) {
      return new Response(null, { status: 204 });
    }

    const [conversation] = await db
      .select({
        id: conversations.id,
        userId: conversations.userId,
      })
      .from(conversations)
      .where(eq(conversations.id, id))
      .limit(1);

    if (!conversation || conversation.userId !== userId) {
      return new Response(null, { status: 204 });
    }

    const activeStreamId = await getConversationActiveStreamId(id, userId);

    if (!activeStreamId) {
      return new Response(null, { status: 204 });
    }

    const streamContext = getChatResumableStreamContext(after);
    const stream = await streamContext.resumeExistingStream(activeStreamId);

    if (!stream) {
      return new Response(null, { status: 204 });
    }

    return new Response(stream, {
      headers: UI_MESSAGE_STREAM_HEADERS,
    });
  },
);
