import "server-only";

import { type UIMessage, validateUIMessages } from "ai";
import type { z } from "zod";
import { env } from "@/config/env";
import { badRequest } from "@/lib/api";
import { parseJsonBodyWithinLimit } from "@/lib/api/request-body";

interface ConversationEnvelope {
  messages: unknown;
}

export interface ValidatedConversationRequest<T, M extends UIMessage> {
  input: Omit<T, "messages">;
  messages: M[];
  estimatedTokens: number;
}

export function estimateConversationTokens(value: unknown): number {
  const serialized = JSON.stringify(value) ?? "";
  let asciiCharacters = 0;
  let nonAsciiCharacters = 0;

  for (const character of serialized) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint > 0x7f) {
      nonAsciiCharacters += 1;
    } else {
      asciiCharacters += 1;
    }
  }

  return Math.ceil(asciiCharacters / 4) + nonAsciiCharacters;
}

function assertMessageBudgets(messages: UIMessage[]): number {
  let filePartCount = 0;

  for (const message of messages) {
    if (message.role === "system") {
      throw badRequest("客户端消息不能包含 system 角色", "SYSTEM_MESSAGE_NOT_ALLOWED");
    }
    if (message.parts.length > env.AI_CONVERSATION_MAX_PARTS_PER_MESSAGE) {
      throw badRequest("消息内容过于复杂", "MESSAGE_PART_LIMIT_EXCEEDED");
    }

    for (const part of message.parts) {
      if (
        (part.type === "text" || part.type === "reasoning") &&
        part.text.length > env.AI_CONVERSATION_MAX_TEXT_PART_CHARACTERS
      ) {
        throw badRequest("单条消息内容过长", "MESSAGE_TEXT_LIMIT_EXCEEDED");
      }
      if (part.type === "file") {
        filePartCount += 1;
      }
    }
  }

  if (filePartCount > 0) {
    throw badRequest("当前会话不支持文件消息", "FILE_PART_LIMIT_EXCEEDED");
  }

  const estimatedTokens = estimateConversationTokens(messages);
  if (estimatedTokens > env.AI_CONVERSATION_MAX_ESTIMATED_TOKENS) {
    throw badRequest("会话上下文过长", "CONVERSATION_TOKEN_LIMIT_EXCEEDED");
  }

  return estimatedTokens;
}

export async function parseConversationRequest<
  T extends ConversationEnvelope,
  M extends UIMessage = UIMessage,
>(request: Request, schema: z.ZodType<T>): Promise<ValidatedConversationRequest<T, M>> {
  const input = await parseJsonBodyWithinLimit(
    request,
    schema,
    env.AI_CONVERSATION_MAX_REQUEST_BYTES,
  );

  let messages: M[];
  try {
    messages = await validateUIMessages<M>({ messages: input.messages });
  } catch {
    throw badRequest("消息格式无效", "INVALID_UI_MESSAGES");
  }

  if (messages.length > env.AI_CONVERSATION_MAX_MESSAGES) {
    throw badRequest("会话消息过多", "CONVERSATION_MESSAGE_LIMIT_EXCEEDED");
  }

  const estimatedTokens = assertMessageBudgets(messages);
  const { messages: _unvalidatedMessages, ...validatedEnvelope } = input;
  return {
    input: validatedEnvelope,
    messages,
    estimatedTokens,
  };
}
