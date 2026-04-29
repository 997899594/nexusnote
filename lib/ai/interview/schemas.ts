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

export const InterviewOutlineSkillIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .transform((value) => value.trim());

function normalizedSkillIdArray(maxItems: number) {
  return z.preprocess((value) => {
    if (!Array.isArray(value)) {
      return value;
    }

    const seen = new Set<string>();
    const normalized = value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
      .filter((item) => {
        if (seen.has(item)) {
          return false;
        }

        seen.add(item);
        return true;
      })
      .slice(0, maxItems);

    return normalized.length > 0 ? normalized : undefined;
  }, z.array(InterviewOutlineSkillIdSchema).min(1).max(maxItems).optional());
}

export const InterviewOutlineSectionSchema = z.object({
  title: z.string().min(1).max(80),
});

export const InterviewOutlineChapterSchema = z.object({
  title: z.string().min(1).max(120),
  sections: z.array(InterviewOutlineSectionSchema).min(2).max(4),
  practiceType: z.enum(["exercise", "project", "quiz", "none"]).optional(),
  skillIds: normalizedSkillIdArray(4),
});

export const InterviewOutlineSchema = z.object({
  title: z.string().min(1).max(120),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]),
  chapters: z.array(InterviewOutlineChapterSchema).min(5).max(7),
  courseSkillIds: normalizedSkillIdArray(6),
  description: z.string().min(1).max(300).optional(),
  targetAudience: z.string().min(1).max(200).optional(),
  learningOutcome: z.string().min(1).max(240).optional(),
});

export const InterviewPhaseSchema = z.enum(["discover", "revise"]);

export const InterviewStateSchema = z.object({
  phase: InterviewPhaseSchema,
  topic: nullableNormalizedString(240),
  targetOutcome: nullableNormalizedString(280),
  currentBaseline: nullableNormalizedString(280),
  constraints: normalizedStringArray(120, 4),
  revisionIntent: nullableNormalizedString(240),
  confidence: z.number().min(0).max(1),
});

export const InterviewNextFocusSchema = z.enum([
  "topic",
  "targetOutcome",
  "currentBaseline",
  "constraints",
  "revision",
]);

export const InterviewSufficiencySchema = z.object({
  allowOutline: z.boolean(),
  missingCoreFields: z.array(z.enum(["topic", "targetOutcome", "currentBaseline"])).max(3),
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

export type InterviewApiMessage = z.infer<typeof InterviewApiMessageSchema>;
export type InterviewNextFocus = z.infer<typeof InterviewNextFocusSchema>;
export type InterviewPhase = z.infer<typeof InterviewPhaseSchema>;
export type InterviewOutline = z.infer<typeof InterviewOutlineSchema>;
export type InterviewState = z.infer<typeof InterviewStateSchema>;
export type InterviewSufficiency = z.infer<typeof InterviewSufficiencySchema>;
export type InterviewTurn = z.infer<typeof InterviewTurnSchema>;
