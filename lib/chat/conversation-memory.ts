import { generateText, type UIMessage } from "ai";
import { getPlainModelForPolicy } from "@/lib/ai";
import { classifyAIDegradation } from "@/lib/ai/core/degradation";

function extractPlainTranscript(messages: UIMessage[]): string {
  return messages
    .map((message) => {
      const text = message.parts
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("\n")
        .trim();

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
      system: `你在维护一份长期对话记忆。

请把较早的历史对话压缩成可长期保留的中文摘要，供后续聊天继续使用。

要求：
- 保留长期有效的信息，不保留寒暄
- 重点提取：用户目标、背景、偏好、已确认结论、未解决问题、约束
- 允许合并已有摘要与新增历史
- 输出 6 条以内短 bullet，每条一行
- 不要编造不存在的信息`,
      prompt: [
        existingSummary?.trim() ? `已有摘要：\n${existingSummary.trim()}` : null,
        `新增历史：\n${transcript}`,
      ]
        .filter(Boolean)
        .join("\n\n"),
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
