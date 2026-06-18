import { getToolName, isDataUIPart, isToolUIPart, type ToolUIPart, type UIMessage } from "ai";
import { extractUIMessageText } from "@/lib/ai/message-text";
import type { ResearchCitation } from "@/lib/ai/research/contracts";
import { isChatVisibleTool } from "@/lib/ai/tools/shared/display-contract";

const BACKGROUND_RESEARCH_ACKNOWLEDGEMENT = "已开始深度研究。";

export interface ChatResearchSourcesData {
  sourceCount: number;
  completedAt: string;
  sources: ResearchCitation[];
}

export type ChatActivityKind = "drafting" | "web_search" | "note_search";

export interface ChatActivity {
  kind: ChatActivityKind;
  label: string | null;
}

export interface ChatDisplayMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  researchSources?: ChatResearchSourcesData | null;
  toolParts?: ToolUIPart[];
  activity?: ChatActivity | null;
}

interface ToChatDisplayMessagesOptions {
  activeAssistantMessageId?: string | null;
  appendAssistantActivity?: boolean;
  assistantActivityId?: string;
  suppressBackgroundResearchAcknowledgement?: boolean;
}

function stripMarkdownSourcesSection(content: string): string {
  return content.replace(/\n## 来源[\s\S]*$/u, "").trim();
}

function getResearchSources(message: UIMessage): ChatResearchSourcesData | null {
  if (message.role !== "assistant") {
    return null;
  }

  for (let index = message.parts.length - 1; index >= 0; index -= 1) {
    const part = message.parts[index];
    if (isDataUIPart(part) && part.type === "data-researchSources") {
      return part.data as ChatResearchSourcesData;
    }
  }

  return null;
}

function getVisibleToolParts(message: UIMessage): ToolUIPart[] {
  return (message.parts.filter(isToolUIPart) as ToolUIPart[]).filter((part) =>
    isChatVisibleTool(getToolName(part)),
  );
}

function hasRenderableToolOutput(toolParts: ToolUIPart[]): boolean {
  return toolParts.some((part) => part.state === "output-available");
}

function getPendingActivity(toolParts: ToolUIPart[]): ChatActivity {
  const pendingToolNames = toolParts
    .filter((part) => part.state !== "output-available")
    .map((part) => getToolName(part));

  if (pendingToolNames.includes("webSearch")) {
    return {
      kind: "web_search",
      label: "检索",
    };
  }

  if (pendingToolNames.includes("searchNotes")) {
    return {
      kind: "note_search",
      label: "笔记",
    };
  }

  return {
    kind: "drafting",
    label: null,
  };
}

function resolveAssistantActivity(params: {
  isActiveAssistant: boolean;
  text: string;
  researchSources: ChatResearchSourcesData | null;
  toolParts: ToolUIPart[];
}): ChatActivity | null {
  if (
    !params.isActiveAssistant ||
    params.text.length > 0 ||
    params.researchSources ||
    hasRenderableToolOutput(params.toolParts)
  ) {
    return null;
  }

  return getPendingActivity(params.toolParts);
}

export function toChatDisplayMessages(
  messages: UIMessage[],
  options: ToChatDisplayMessagesOptions = {},
): ChatDisplayMessage[] {
  const displayMessages: ChatDisplayMessage[] = [];

  for (const message of messages) {
    if (message.role !== "user" && message.role !== "assistant") {
      continue;
    }

    if (message.role === "user") {
      const text = extractUIMessageText(message, { separator: "" });
      if (text.length === 0) {
        continue;
      }

      displayMessages.push({
        id: message.id,
        role: "user",
        text,
      });
      continue;
    }

    const extractedText = extractUIMessageText(message, { separator: "" });
    const rawText =
      options.suppressBackgroundResearchAcknowledgement !== false &&
      extractedText.trim() === BACKGROUND_RESEARCH_ACKNOWLEDGEMENT
        ? ""
        : extractedText;
    const researchSources = getResearchSources(message);
    const text = researchSources ? stripMarkdownSourcesSection(rawText) : rawText;
    const toolParts = getVisibleToolParts(message);
    const activity = resolveAssistantActivity({
      isActiveAssistant: options.activeAssistantMessageId === message.id,
      text,
      researchSources,
      toolParts,
    });
    const hasVisibleContent =
      text.length > 0 ||
      Boolean(researchSources) ||
      hasRenderableToolOutput(toolParts) ||
      Boolean(activity);

    if (!hasVisibleContent) {
      continue;
    }

    displayMessages.push({
      id: message.id,
      role: "assistant",
      text,
      researchSources,
      toolParts,
      activity,
    });
  }

  if (options.appendAssistantActivity) {
    displayMessages.push({
      id: options.assistantActivityId ?? "chat-assistant-activity",
      role: "assistant",
      text: "",
      activity: {
        kind: "drafting",
        label: null,
      },
    });
  }

  return displayMessages;
}
