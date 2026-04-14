import type { UIMessage } from "ai";
import {
  enqueueCareerTreeRefresh,
  enqueueKnowledgeInsights,
  enqueueKnowledgeSourceMerge,
} from "@/lib/career-tree/queue";
import { extractMessageText } from "@/lib/chat/conversation-messages";
import { getOwnedConversation } from "@/lib/chat/conversation-repository";
import { deleteEvidenceEventsBySource, ingestEvidenceEvent } from "@/lib/knowledge/events";
import {
  aggregateSourceEventsToKnowledgeEvidence,
  listLinkedNodeIdsForEvidenceSource,
} from "@/lib/knowledge/evidence";

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

function buildConversationSummary(messages: UIMessage[]) {
  const snippets = getConversationSnippets(messages);
  const summary = snippets
    .map((item) => item.text)
    .join("\n\n")
    .trim();
  return summary.length > 800 ? `${summary.slice(0, 800).trim()}...` : summary;
}

export async function syncLearnConversationKnowledge(params: {
  conversationId: string;
  userId: string;
  messages: UIMessage[];
}): Promise<void> {
  const conversation = await getOwnedConversation(params.conversationId, params.userId);
  if (!conversation?.learnCourseId) {
    return;
  }

  const affectedNodeIds = await listLinkedNodeIdsForEvidenceSource({
    userId: params.userId,
    sourceType: "conversation",
    sourceId: params.conversationId,
  });

  await deleteEvidenceEventsBySource({
    userId: params.userId,
    sourceType: "conversation",
    sourceId: params.conversationId,
    sourceVersionHash: null,
  });

  const snippets = getConversationSnippets(params.messages);
  const summary = buildConversationSummary(params.messages);

  if (summary.length > 0) {
    await ingestEvidenceEvent({
      id: crypto.randomUUID(),
      userId: params.userId,
      kind: "conversation",
      sourceType: "conversation",
      sourceId: params.conversationId,
      sourceVersionHash: null,
      title: conversation.title || "学习对话",
      summary,
      confidence: 1,
      happenedAt: new Date().toISOString(),
      metadata: {
        intent: conversation.intent,
        courseId: conversation.learnCourseId,
        chapterIndex: conversation.learnChapterIndex,
      },
      refs: [
        ...snippets.map((item) => ({
          refType: `conversation_message_${item.role}`,
          refId: `${params.conversationId}:${item.index}`,
          snippet: item.text,
          weight: 1,
        })),
        ...(typeof conversation.learnChapterIndex === "number"
          ? [
              {
                refType: "chapter",
                refId: `chapter-${conversation.learnChapterIndex + 1}`,
                snippet: null,
                weight: 1,
              },
            ]
          : []),
      ],
    });
  }

  await aggregateSourceEventsToKnowledgeEvidence({
    userId: params.userId,
    sourceType: "conversation",
    sourceId: params.conversationId,
    sourceVersionHash: null,
  });

  if (summary.length > 0) {
    await enqueueKnowledgeSourceMerge({
      userId: params.userId,
      sourceType: "conversation",
      sourceId: params.conversationId,
      sourceVersionHash: null,
      affectedNodeIds,
    });
    return;
  }

  if (affectedNodeIds.length > 0) {
    await enqueueCareerTreeRefresh(params.userId, undefined, affectedNodeIds);
  } else {
    await enqueueKnowledgeInsights(params.userId);
  }
}
