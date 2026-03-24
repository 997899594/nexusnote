import { z } from "zod";

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
export type InterviewOutline = z.infer<typeof InterviewOutlineSchema>;
export type InterviewPartialTurn = z.infer<typeof InterviewStreamDeltaEventSchema>["turn"];
export type InterviewTurn = z.infer<typeof InterviewTurnSchema>;
export type InterviewStreamEvent = z.infer<typeof InterviewStreamEventSchema>;
