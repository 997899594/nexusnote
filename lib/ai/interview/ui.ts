import { getToolName, isToolUIPart, type UIMessage } from "ai";
import type { z } from "zod";
import type {
  PresentOptionsInputSchema,
  PresentOptionsOutput,
  PresentOutlinePreviewInputSchema,
  PresentOutlinePreviewOutput,
} from "@/lib/ai/tools/interview";
import type { InterviewMode, InterviewOutline } from "./schemas";

export interface InterviewOutlinePreviewData {
  mode: InterviewMode;
  outline: InterviewOutline;
}

export type InterviewUIMessage = UIMessage<
  never,
  never,
  {
    presentOptions: {
      input: z.infer<typeof PresentOptionsInputSchema>;
      output: PresentOptionsOutput;
    };
    presentOutlinePreview: {
      input: z.infer<typeof PresentOutlinePreviewInputSchema>;
      output: PresentOutlinePreviewOutput;
    };
  }
>;

export function getInterviewMessageText(message: UIMessage): string {
  const text = message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("")
    .trim();

  if (text.length > 0) {
    return text;
  }

  for (let i = message.parts.length - 1; i >= 0; i--) {
    const part = message.parts[i];
    if (isToolUIPart(part) && getToolName(part) === "presentOutlinePreview") {
      return String((part.input as { message?: string } | undefined)?.message ?? "").trim();
    }
    if (isToolUIPart(part) && getToolName(part) === "presentOptions") {
      return String((part.input as { question?: string } | undefined)?.question ?? "").trim();
    }
  }

  return "";
}

export function getInterviewMessageOptions(message: InterviewUIMessage): string[] {
  for (let i = message.parts.length - 1; i >= 0; i--) {
    const part = message.parts[i];
    if (isToolUIPart(part) && getToolName(part) === "presentOutlinePreview") {
      const input = part.input as { options?: string[] } | undefined;
      return Array.isArray(input?.options) ? input.options : [];
    }
    if (isToolUIPart(part) && getToolName(part) === "presentOptions") {
      const input = part.input as { options?: string[] } | undefined;
      return Array.isArray(input?.options) ? input.options : [];
    }
  }

  return [];
}

export function getInterviewMessageMode(message: InterviewUIMessage): "question" | "outline" {
  for (let i = message.parts.length - 1; i >= 0; i--) {
    const part = message.parts[i];
    if (isToolUIPart(part) && getToolName(part) === "presentOutlinePreview") {
      return "outline";
    }
  }

  return "question";
}

export function findLatestOutline(
  messages: InterviewUIMessage[],
): InterviewOutlinePreviewData | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role !== "assistant") {
      continue;
    }

    for (const part of message.parts) {
      if (isToolUIPart(part) && getToolName(part) === "presentOutlinePreview") {
        const input = part.input as { outline?: InterviewOutline } | undefined;
        if (input?.outline) {
          return { mode: "revise", outline: input.outline };
        }
      }
    }
  }

  return null;
}
