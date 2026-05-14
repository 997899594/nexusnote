import { getToolName, isToolUIPart, type UIMessage } from "ai";
import type { z } from "zod";
import { extractUIMessageText } from "@/lib/ai/message-text";
import type {
  PresentOptionsInputSchema,
  PresentOptionsOutput,
  PresentOutlinePreviewInputSchema,
  PresentOutlinePreviewOutput,
} from "@/lib/ai/tools/interview";
import { isInterviewVisibleTool } from "@/lib/ai/tools/shared/display-contract";
import type { InterviewOptionAction, OutlineDisplay } from "./models";
import { type InterviewOutline, InterviewOutlineSchema } from "./schemas";

export interface InterviewOutlinePreviewData {
  outline: OutlineDisplay | null;
  isComplete: boolean;
  isStarted: boolean;
  message?: string;
  options?: InterviewOptionAction[];
}

export interface InterviewStableOutlineData {
  outline: InterviewOutline;
}

export interface InterviewDisplayMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  mode?: "question" | "outline";
  options?: InterviewOptionAction[];
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

function getLatestInterviewToolPart(message: UIMessage) {
  for (let i = message.parts.length - 1; i >= 0; i--) {
    const part = message.parts[i];
    if (isToolUIPart(part) && isInterviewVisibleTool(getToolName(part))) {
      return part;
    }
  }

  return null;
}

function findLatestOutlinePreviewPart(messages: InterviewUIMessage[], requireStableState: boolean) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role !== "assistant") {
      continue;
    }

    for (let partIndex = message.parts.length - 1; partIndex >= 0; partIndex--) {
      const part = message.parts[partIndex];
      if (
        !isToolUIPart(part) ||
        !isInterviewVisibleTool(getToolName(part)) ||
        getToolName(part) !== "presentOutlinePreview"
      ) {
        continue;
      }

      if (
        requireStableState &&
        part.state !== "input-available" &&
        part.state !== "output-available"
      ) {
        continue;
      }

      return part;
    }
  }

  return null;
}

export function getInterviewMessageText(message: UIMessage): string {
  const text = extractUIMessageText(message, { separator: "" });

  if (text.length > 0) {
    return text;
  }

  const toolPart = getLatestInterviewToolPart(message);
  if (!toolPart) {
    return "";
  }

  if (getToolName(toolPart) === "presentOutlinePreview") {
    return String((toolPart.input as { message?: string } | undefined)?.message ?? "").trim();
  }

  if (getToolName(toolPart) === "presentOptions") {
    return String((toolPart.input as { question?: string } | undefined)?.question ?? "").trim();
  }

  return "";
}

export function getInterviewMessageOptions(message: InterviewUIMessage): InterviewOptionAction[] {
  const toolPart = getLatestInterviewToolPart(message);
  if (!toolPart) {
    return [];
  }

  const input = toolPart.input as { options?: unknown } | undefined;
  if (getToolName(toolPart) === "presentOutlinePreview") {
    return normalizeInterviewOptions(input?.options, "revise");
  }

  if (getToolName(toolPart) === "presentOptions") {
    return normalizeInterviewOptions(input?.options, "reply");
  }

  return [];
}

function normalizePracticeType(
  value: unknown,
): "exercise" | "project" | "quiz" | "none" | undefined {
  return value === "exercise" || value === "project" || value === "quiz" || value === "none"
    ? value
    : undefined;
}

function normalizeStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const strings = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);

  return strings.length > 0 ? strings : undefined;
}

function normalizeInterviewOptions(
  value: unknown,
  defaultIntent: InterviewOptionAction["intent"],
): InterviewOptionAction[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item): InterviewOptionAction | null => {
      if (typeof item === "string") {
        const label = item.trim();
        return label ? { label, intent: defaultIntent } : null;
      }

      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as Record<string, unknown>;
      const label = typeof record.label === "string" ? record.label.trim() : "";
      if (!label) {
        return null;
      }

      const intent =
        record.intent === "reply" || record.intent === "revise" || record.intent === "start_course"
          ? record.intent
          : defaultIntent;
      const action = typeof record.action === "string" ? record.action.trim() : undefined;

      return {
        label,
        intent,
        ...(action ? { action } : {}),
      };
    })
    .filter((option): option is InterviewOptionAction => option != null);
}

function normalizePartialOutline(raw: unknown): OutlineDisplay | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const outline = raw as {
    title?: unknown;
    description?: unknown;
    targetAudience?: unknown;
    difficulty?: unknown;
    learningOutcome?: unknown;
    courseSkillIds?: unknown;
    chapters?: unknown;
  };

  const chapters = Array.isArray(outline.chapters)
    ? outline.chapters
        .filter(
          (chapter): chapter is Record<string, unknown> => !!chapter && typeof chapter === "object",
        )
        .map((chapter) => ({
          title: typeof chapter.title === "string" ? chapter.title : "",
          description: typeof chapter.description === "string" ? chapter.description : undefined,
          practiceType: normalizePracticeType(chapter.practiceType),
          skillIds: normalizeStringArray(chapter.skillIds),
          sections: Array.isArray(chapter.sections)
            ? chapter.sections
                .filter(
                  (section): section is Record<string, unknown> =>
                    !!section && typeof section === "object",
                )
                .map((section) => ({
                  title: typeof section.title === "string" ? section.title : "",
                  description:
                    typeof section.description === "string" ? section.description : undefined,
                }))
                .filter((section) => section.title.length > 0)
            : [],
        }))
        .filter((chapter) => chapter.title.length > 0 || chapter.sections.length > 0)
    : [];

  const hasAnyContent =
    (typeof outline.title === "string" && outline.title.length > 0) || chapters.length > 0;

  if (!hasAnyContent) {
    return null;
  }

  return {
    title: typeof outline.title === "string" ? outline.title : undefined,
    description: typeof outline.description === "string" ? outline.description : undefined,
    targetAudience: typeof outline.targetAudience === "string" ? outline.targetAudience : undefined,
    difficulty:
      outline.difficulty === "beginner" ||
      outline.difficulty === "intermediate" ||
      outline.difficulty === "advanced"
        ? outline.difficulty
        : undefined,
    learningOutcome:
      typeof outline.learningOutcome === "string" ? outline.learningOutcome : undefined,
    courseSkillIds: normalizeStringArray(outline.courseSkillIds),
    chapters,
  };
}

function normalizeStableOutline(raw: unknown): InterviewOutline | null {
  const parsed = InterviewOutlineSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function findLatestOutline(
  messages: InterviewUIMessage[],
): InterviewOutlinePreviewData | null {
  const part = findLatestOutlinePreviewPart(messages, false);
  if (!part) {
    return null;
  }

  const input = part.input as
    | { message?: unknown; options?: unknown; outline?: unknown }
    | undefined;
  const outline = normalizePartialOutline(input?.outline);
  const stableOutline = normalizeStableOutline(input?.outline);
  const options = normalizeInterviewOptions(input?.options, "revise");

  return {
    outline,
    isComplete:
      stableOutline != null ||
      part.state === "input-available" ||
      part.state === "output-available",
    isStarted: true,
    ...(typeof input?.message === "string" ? { message: input.message } : {}),
    ...(options.length > 0 ? { options } : {}),
  };
}

export function findLatestStableOutline(
  messages: InterviewUIMessage[],
): InterviewStableOutlineData | null {
  const part = findLatestOutlinePreviewPart(messages, false);
  if (!part) {
    return null;
  }

  const input = part.input as { outline?: unknown } | undefined;
  const outline = normalizeStableOutline(input?.outline);
  if (outline) {
    return {
      outline,
    };
  }

  return null;
}

export function toInterviewDisplayMessages(
  messages: InterviewUIMessage[],
): InterviewDisplayMessage[] {
  return messages
    .filter(
      (
        message,
      ): message is InterviewUIMessage & {
        role: "user" | "assistant";
      } => message.role === "user" || message.role === "assistant",
    )
    .map((message) => {
      const mode: InterviewDisplayMessage["mode"] =
        message.role === "assistant"
          ? findLatestOutline([message])
            ? "outline"
            : "question"
          : undefined;

      return {
        id: message.id,
        role: message.role,
        text: getInterviewMessageText(message),
        mode,
        options: message.role === "assistant" ? getInterviewMessageOptions(message) : undefined,
      };
    })
    .filter((message) => message.text.length > 0 || (message.options?.length ?? 0) > 0);
}

export function getLatestVisibleInterviewAssistantMessage(
  messages: InterviewUIMessage[],
): InterviewDisplayMessage | null {
  return (
    [...toInterviewDisplayMessages(messages)]
      .reverse()
      .find((message) => message.role === "assistant") ?? null
  );
}
