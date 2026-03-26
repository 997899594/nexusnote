import { z } from "zod";

function nullableNormalizedString(max: number) {
  return z.preprocess((value) => {
    if (typeof value !== "string") {
      return value;
    }

    const normalized = value.trim();
    return normalized.length === 0 ? null : normalized;
  }, z.string().min(1).max(max).nullable());
}

function normalizedStringArray(maxItemLength: number, maxItems: number) {
  return z.preprocess(
    (value) => {
      if (!Array.isArray(value)) {
        return value;
      }

      return value
        .map((item) => (typeof item === "string" ? item.trim() : item))
        .filter((item) => typeof item === "string" && item.length > 0);
    },
    z.array(z.string().min(1).max(maxItemLength)).max(maxItems),
  );
}

export const InterviewOutlineSectionSchema = z.object({
  title: z.string().min(1).max(80),
  description: z.string().min(1).max(240),
});

export const InterviewOutlineChapterSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().min(1).max(300),
  sections: z.array(InterviewOutlineSectionSchema).min(1).max(5),
  estimatedMinutes: z.number().int().positive().max(600).optional(),
  practiceType: z.enum(["exercise", "project", "quiz", "none"]).optional(),
});

export const InterviewOutlineSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().min(1).max(400),
  targetAudience: z.string().min(1).max(200),
  prerequisites: z.array(z.string().min(1).max(80)).max(8).optional(),
  estimatedHours: z.number().positive().max(500),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]),
  chapters: z.array(InterviewOutlineChapterSchema).min(1).max(12),
  learningOutcome: z.string().min(1).max(240),
});

export const InterviewModeSchema = z.enum(["discover", "revise"]);

export const InterviewStateSchema = z.object({
  mode: InterviewModeSchema,
  goal: nullableNormalizedString(300),
  background: nullableNormalizedString(300),
  useCase: nullableNormalizedString(300),
  constraints: z.object({
    timeBudget: nullableNormalizedString(120),
    preferredDepth: nullableNormalizedString(120),
  }),
  preferences: z.object({
    style: nullableNormalizedString(120),
    focusAreas: normalizedStringArray(80, 8),
  }),
  openQuestions: normalizedStringArray(120, 6),
  confidence: z.number().min(0).max(1),
});

export const InterviewNextFocusSchema = z.enum([
  "goal",
  "background",
  "useCase",
  "constraints",
  "preferences",
  "revise",
]);

export const InterviewSufficiencySchema = z.object({
  allowOutline: z.boolean(),
  missingCoreFields: z.array(z.enum(["goal", "background", "useCase"])).max(3),
  nextFocus: InterviewNextFocusSchema,
  reason: z.string().min(1).max(240),
});

export const InterviewQuestionTurnSchema = z.object({
  kind: z.literal("question"),
  message: z.string().min(1).max(1200),
  options: z.array(z.string().min(1).max(80)).min(2).max(4),
});

export const InterviewOutlineTurnSchema = z.object({
  kind: z.literal("outline"),
  message: z.string().min(1).max(1200),
  options: z.array(z.string().min(1).max(80)).min(2).max(4),
  outline: InterviewOutlineSchema,
});

export const InterviewTurnSchema = z.discriminatedUnion("kind", [
  InterviewQuestionTurnSchema,
  InterviewOutlineTurnSchema,
]);

export const InterviewApiMessageSchema = z.object({
  id: z.string().optional(),
  role: z.enum(["user", "assistant"]),
  text: z.string().min(1).max(4000),
});

export const InterviewStreamDeltaEventSchema = z.object({
  type: z.literal("turn-delta"),
  turn: z.object({
    kind: z.enum(["question", "outline"]).optional(),
    message: z.string().optional(),
    options: z.array(z.string()).optional(),
    outline: z.unknown().optional(),
  }),
});

export const InterviewStreamCompleteEventSchema = z.object({
  type: z.literal("turn-complete"),
  turn: InterviewTurnSchema,
  courseId: z.string().uuid().optional(),
});

export const InterviewStreamErrorEventSchema = z.object({
  type: z.literal("error"),
  error: z.string().min(1),
});

export const InterviewStreamEventSchema = z.discriminatedUnion("type", [
  InterviewStreamDeltaEventSchema,
  InterviewStreamCompleteEventSchema,
  InterviewStreamErrorEventSchema,
]);

export type InterviewApiMessage = z.infer<typeof InterviewApiMessageSchema>;
export type InterviewMode = z.infer<typeof InterviewModeSchema>;
export type InterviewOutline = z.infer<typeof InterviewOutlineSchema>;
export type InterviewPartialTurn = z.infer<typeof InterviewStreamDeltaEventSchema>["turn"];
export type InterviewState = z.infer<typeof InterviewStateSchema>;
export type InterviewSufficiency = z.infer<typeof InterviewSufficiencySchema>;
export type InterviewTurn = z.infer<typeof InterviewTurnSchema>;
export type InterviewStreamEvent = z.infer<typeof InterviewStreamEventSchema>;
