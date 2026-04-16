import { getToolName, isToolUIPart, type UIMessage } from "ai";
import type { z } from "zod";
import { extractUIMessageText } from "@/lib/ai/message-text";
import type {
  PresentOptionsInputSchema,
  PresentOptionsOutput,
  PresentOutlinePreviewInputSchema,
  PresentOutlinePreviewOutput,
} from "@/lib/ai/tools/interview";
import { isInterviewVisibleTool } from "@/lib/ai/tools/shared";
import type { OutlineDisplay } from "./models";
import { type InterviewMode, type InterviewOutline, InterviewOutlineSchema } from "./schemas";

export interface InterviewOutlinePreviewData {
  mode: InterviewMode;
  outline: OutlineDisplay;
  isComplete: boolean;
}

export interface InterviewStableOutlineData {
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

    for (const part of message.parts) {
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

export function getInterviewMessageOptions(message: InterviewUIMessage): string[] {
  const toolPart = getLatestInterviewToolPart(message);
  if (!toolPart) {
    return [];
  }

  if (
    getToolName(toolPart) === "presentOutlinePreview" ||
    getToolName(toolPart) === "presentOptions"
  ) {
    const input = toolPart.input as { options?: string[] } | undefined;
    return Array.isArray(input?.options) ? input.options : [];
  }

  return [];
}

export function getInterviewMessageMode(message: InterviewUIMessage): "question" | "outline" {
  const toolPart = getLatestInterviewToolPart(message);
  if (!toolPart) {
    return "question";
  }

  return getToolName(toolPart) === "presentOutlinePreview" ? "outline" : "question";
}

function normalizePracticeType(
  value: unknown,
): "exercise" | "project" | "quiz" | "none" | undefined {
  return value === "exercise" || value === "project" || value === "quiz" || value === "none"
    ? value
    : undefined;
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
          skillIds: Array.isArray(chapter.skillIds)
            ? chapter.skillIds.filter((skillId): skillId is string => typeof skillId === "string")
            : undefined,
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
    courseSkillIds: Array.isArray(outline.courseSkillIds)
      ? outline.courseSkillIds.filter((skillId): skillId is string => typeof skillId === "string")
      : undefined,
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

  const input = part.input as { outline?: unknown } | undefined;
  const outline = normalizePartialOutline(input?.outline);
  if (outline) {
    return {
      mode: "revise",
      outline,
      isComplete: part.state === "input-available" || part.state === "output-available",
    };
  }

  return null;
}

export function findLatestStableOutline(
  messages: InterviewUIMessage[],
): InterviewStableOutlineData | null {
  const part = findLatestOutlinePreviewPart(messages, true);
  if (!part) {
    return null;
  }

  const input = part.input as { outline?: unknown } | undefined;
  const outline = normalizeStableOutline(input?.outline);
  if (outline) {
    return {
      mode: "revise",
      outline,
    };
  }

  return null;
}
