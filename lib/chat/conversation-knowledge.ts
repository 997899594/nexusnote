import type { UIMessage } from "ai";
import { extractMessageText } from "@/lib/chat/conversation-messages";
import { getOwnedConversation } from "@/lib/chat/conversation-repository";
import { ingestEvidenceEvent } from "@/lib/knowledge/events";
import { syncKnowledgeSource } from "@/lib/knowledge/source-sync";
import { buildChapterOutlineNodeKey } from "@/lib/learning/outline-node-key";
import { syncSourceKnowledgeEvidenceChunks } from "@/lib/rag/chunker";

interface ConversationRef {
  refType: string;
  refId: string;
  snippet: string | null;
  weight: number;
}

type OwnedConversationRecord = NonNullable<Awaited<ReturnType<typeof getOwnedConversation>>>;

function getConversationSnippets(messages: UIMessage[]) {
  return messages
    .map((message, index) => ({
      index,
      role: message.role,
      text: extractMessageText(message).trim(),
    }))
    .filter((item) => item.text.length > 0)
    .slice(-6);
}

function buildConversationSummary(snippets: ReturnType<typeof getConversationSnippets>) {
  const summary = snippets
    .map((item) => item.text)
    .join("\n\n")
    .trim();
  return summary.length > 800 ? `${summary.slice(0, 800).trim()}...` : summary;
}

function buildConversationMetadata(conversation: OwnedConversationRecord): Record<string, unknown> {
  return {
    intent: conversation.intent,
    courseId: conversation.learnCourseId ?? null,
    chapterIndex: conversation.learnChapterIndex ?? null,
    messageCount: conversation.messageCount ?? 0,
  };
}

function buildConversationRefs(params: {
  conversationId: string;
  learnCourseId: string | null;
  learnChapterIndex: number | null;
  snippets: ReturnType<typeof getConversationSnippets>;
}): ConversationRef[] {
  const refs: ConversationRef[] = params.snippets.map((item) => ({
    refType: `conversation_message_${item.role}`,
    refId: `${params.conversationId}:${item.index}`,
    snippet: item.text,
    weight: 1,
  }));

  if (params.learnCourseId) {
    refs.push({
      refType: "course",
      refId: params.learnCourseId,
      snippet: null,
      weight: 1,
    });
  }

  if (typeof params.learnChapterIndex === "number") {
    refs.push({
      refType: "chapter",
      refId: buildChapterOutlineNodeKey(params.learnChapterIndex),
      snippet: null,
      weight: 1,
    });
  }

  return refs;
}

export async function syncConversationKnowledge(params: {
  conversationId: string;
  userId: string;
  messages: UIMessage[];
}): Promise<void> {
  const conversation = await getOwnedConversation(params.conversationId, params.userId);
  if (!conversation) {
    return;
  }

  const snippets = getConversationSnippets(params.messages);
  const summary = buildConversationSummary(snippets);
  const metadata = buildConversationMetadata(conversation);

  await syncKnowledgeSource({
    userId: params.userId,
    sourceType: "conversation",
    sourceId: params.conversationId,
    hasContent: summary.length > 0,
    clearReason: `conversation-clear:${params.conversationId}`,
    replaceEvents: async () => {
      if (summary.length === 0) {
        return;
      }

      await ingestEvidenceEvent({
        id: crypto.randomUUID(),
        userId: params.userId,
        kind: "conversation",
        sourceType: "conversation",
        sourceId: params.conversationId,
        sourceVersionHash: null,
        title: conversation.title || "对话记录",
        summary,
        confidence: 1,
        happenedAt: new Date().toISOString(),
        metadata,
        refs: buildConversationRefs({
          conversationId: params.conversationId,
          learnCourseId: conversation.learnCourseId ?? null,
          learnChapterIndex: conversation.learnChapterIndex ?? null,
          snippets,
        }),
      });
    },
    syncChunks: async () => {
      await syncSourceKnowledgeEvidenceChunks({
        userId: params.userId,
        sourceType: "conversation",
        sourceId: params.conversationId,
        sourceVersionHash: null,
        metadata,
      });
    },
  });
}
