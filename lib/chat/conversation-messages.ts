import type { UIMessage } from "ai";
import { asc, eq, inArray } from "drizzle-orm";
import { conversationMessages, db } from "@/db";

interface ConversationMessageRowInput {
  conversationId: string;
  messages: UIMessage[];
}

function extractTextFromParts(parts: UIMessage["parts"] | undefined): string {
  if (!parts || !Array.isArray(parts)) {
    return "";
  }

  return parts
    .filter((part) => part?.type === "text")
    .map((part) => ("text" in part ? part.text : ""))
    .filter((text) => text.length > 0)
    .join("\n");
}

export function extractMessageText(message: UIMessage): string {
  return extractTextFromParts(message.parts);
}

export function buildConversationMessageRows({
  conversationId,
  messages,
}: ConversationMessageRowInput) {
  return messages.map((message, index) => ({
    conversationId,
    position: index,
    role: message.role,
    message,
    textContent: extractMessageText(message),
  }));
}

export async function loadConversationMessages(conversationId: string): Promise<UIMessage[]> {
  const rows = await db
    .select({
      message: conversationMessages.message,
    })
    .from(conversationMessages)
    .where(eq(conversationMessages.conversationId, conversationId))
    .orderBy(asc(conversationMessages.position));

  if (rows.length > 0) {
    return rows.map((row) => row.message as UIMessage);
  }
  return [];
}

export async function loadConversationMessagesMap(
  conversationIds: string[],
): Promise<Map<string, UIMessage[]>> {
  if (conversationIds.length === 0) {
    return new Map();
  }

  const rows = await db
    .select({
      conversationId: conversationMessages.conversationId,
      position: conversationMessages.position,
      message: conversationMessages.message,
    })
    .from(conversationMessages)
    .where(inArray(conversationMessages.conversationId, conversationIds))
    .orderBy(asc(conversationMessages.conversationId), asc(conversationMessages.position));

  const messagesByConversation = new Map<string, UIMessage[]>();

  for (const row of rows) {
    const existing = messagesByConversation.get(row.conversationId) ?? [];
    existing.push(row.message as UIMessage);
    messagesByConversation.set(row.conversationId, existing);
  }

  return messagesByConversation;
}
