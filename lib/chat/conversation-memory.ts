import { generateText, type UIMessage } from "ai";
import { classifyAIDegradation } from "@/lib/ai/core/degradation";
import { getPlainModelForPolicy } from "@/lib/ai/core/model-policy";
import { loadPromptResource, renderPromptResource } from "@/lib/ai/prompts/load-prompt";
import { extractMessageText } from "@/lib/chat/conversation-messages";

const CONVERSATION_MEMORY_SYSTEM_PROMPT = loadPromptResource("conversation-memory-system.md");
const buildConversationMemoryExistingSummaryBlock = (existingSummary: string | null) =>
  existingSummary?.trim()
    ? renderPromptResource("conversation-memory-existing-summary.md", {
        existing_summary: existingSummary.trim(),
      })
    : "";

const buildConversationMemoryUserPrompt = (existingSummary: string | null, transcript: string) =>
  renderPromptResource("conversation-memory-user.md", {
    existing_summary_block: buildConversationMemoryExistingSummaryBlock(existingSummary),
    new_history: transcript,
  });

function extractPlainTranscript(messages: UIMessage[]): string {
  return messages
    .map((message) => {
      const text = extractMessageText(message).trim();

      if (!text) {
        return null;
      }

      return `${message.role === "user" ? "用户" : "助手"}: ${text}`;
    })
    .filter((value): value is string => Boolean(value))
    .join("\n");
}

function buildHeuristicSummary(
  existingSummary: string | null,
  droppedMessages: UIMessage[],
): string {
  const transcript = extractPlainTranscript(droppedMessages);
  const excerpt = transcript.slice(0, 1200).trim();
  return [existingSummary?.trim(), excerpt ? `历史摘要:\n${excerpt}` : null]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 2000);
}

export async function summarizeDroppedConversationMessages({
  existingSummary,
  droppedMessages,
}: {
  existingSummary: string | null;
  droppedMessages: UIMessage[];
}): Promise<string | null> {
  if (droppedMessages.length === 0) {
    return existingSummary;
  }

  const transcript = extractPlainTranscript(droppedMessages);
  if (!transcript) {
    return existingSummary;
  }

  try {
    const result = await generateText({
      model: getPlainModelForPolicy("interactive-fast"),
      temperature: 0.2,
      system: CONVERSATION_MEMORY_SYSTEM_PROMPT,
      prompt: buildConversationMemoryUserPrompt(existingSummary, transcript),
    });

    const summary = result.text.trim();
    return summary.length > 0 ? summary.slice(0, 4000) : existingSummary;
  } catch (error) {
    const degradation = classifyAIDegradation(error);
    if (degradation) {
      console.warn("[ConversationMemory] AI summary degraded, fallback to heuristic summary.");
    } else {
      console.error("[ConversationMemory] Failed to summarize dropped messages:", error);
    }

    return buildHeuristicSummary(existingSummary, droppedMessages);
  }
}

export function buildConversationMemoryContext(summary: string | null): string | null {
  const normalized = summary?.trim();
  if (!normalized) {
    return null;
  }

  return [`## 长期对话记忆`, normalized].join("\n");
}
