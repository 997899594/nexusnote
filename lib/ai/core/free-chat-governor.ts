import "server-only";

import type { UIMessage } from "ai";
import { env } from "@/config/env";
import { db, sql } from "@/db";
import type { ModelPolicy } from "@/lib/ai/core/model-policy";
import type { ConversationCapabilityMode } from "@/lib/ai/runtime/contracts";
import { buildErrorLogFields, writeStructuredLog } from "@/lib/observability/structured-log";

export type FreeChatCostMode = "standard" | "economy" | "compact";

export interface FreeChatGovernorDecision {
  mode: FreeChatCostMode;
  modelPolicy: ModelPolicy | null;
  maxContextMessages: number;
  dailyTokens: number;
}

interface DailyUsageRow extends Record<string, unknown> {
  total_tokens: number | string | null;
}

function startOfUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function standardDecision(): FreeChatGovernorDecision {
  return {
    mode: "standard",
    modelPolicy: null,
    maxContextMessages: env.FREE_CHAT_STANDARD_CONTEXT_MESSAGES,
    dailyTokens: 0,
  };
}

export async function resolveFreeChatGovernor(params: {
  userId: string;
  capabilityMode: ConversationCapabilityMode;
  now?: Date;
}): Promise<FreeChatGovernorDecision> {
  if (params.capabilityMode !== "general_chat") {
    return {
      mode: "standard",
      modelPolicy: null,
      maxContextMessages: Number.MAX_SAFE_INTEGER,
      dailyTokens: 0,
    };
  }

  try {
    const [usage] = await db.execute<DailyUsageRow>(sql`
      select coalesce(sum(total_tokens), 0) as total_tokens
      from ai_usage
      where user_id = ${params.userId}
        and endpoint = '/api/chat'
        and capability_mode = 'general_chat'
        and created_at >= ${startOfUtcDay(params.now ?? new Date())}
    `);
    const dailyTokens = Number(usage?.total_tokens ?? 0);

    if (dailyTokens >= env.FREE_CHAT_COMPACT_DAILY_TOKENS) {
      return {
        mode: "compact",
        modelPolicy: "interactive-economy",
        maxContextMessages: env.FREE_CHAT_COMPACT_CONTEXT_MESSAGES,
        dailyTokens,
      };
    }
    if (dailyTokens >= env.FREE_CHAT_ECONOMY_DAILY_TOKENS) {
      return {
        mode: "economy",
        modelPolicy: "interactive-economy",
        maxContextMessages: env.FREE_CHAT_ECONOMY_CONTEXT_MESSAGES,
        dailyTokens,
      };
    }

    return { ...standardDecision(), dailyTokens };
  } catch (error) {
    writeStructuredLog("warn", "free_chat_governor_failed_open", {
      userId: params.userId,
      ...buildErrorLogFields(error),
    });
    return standardDecision();
  }
}

export function selectChatModelContext(
  messages: UIMessage[],
  maxContextMessages: number,
): UIMessage[] {
  const systemMessages = messages.filter((message) => message.role === "system");
  const conversationMessages = messages.filter((message) => message.role !== "system");
  return [...systemMessages, ...conversationMessages.slice(-maxContextMessages)];
}
