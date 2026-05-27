import { z } from "zod";

export const careerMapDraftObservationSchema = z.object({
  title: z.string().min(1).max(80),
  summary: z.string().min(1).max(220),
  source: z.enum(["course", "skill_tree", "insight", "interview"]),
});

export const careerMapDraftRouteSchema = z.object({
  directionKey: z.string().min(1).max(120),
  title: z.string().min(1).max(100),
  summary: z.string().min(1).max(260),
  fitScore: z.number().min(0).max(100),
  reason: z.string().min(1).max(280),
  risk: z.string().min(1).max(220),
  gaps: z.array(z.string().min(1).max(100)).max(5),
  nextActions: z.array(z.string().min(1).max(140)).min(1).max(5),
});

export const careerMapDraftNextQuestionSchema = z.object({
  question: z.string().min(1).max(180),
  why: z.string().min(1).max(180),
  options: z.array(z.string().min(1).max(80)).min(2).max(4).optional(),
});

export const careerMapDraftSchema = z.object({
  message: z.string().min(1).max(240),
  selectedRouteKey: z.string().min(1).max(120).optional(),
  observations: z.array(careerMapDraftObservationSchema).min(1).max(5),
  routes: z.array(careerMapDraftRouteSchema).min(1).max(4),
  openQuestions: z.array(z.string().min(1).max(140)).max(5),
  nextQuestion: careerMapDraftNextQuestionSchema,
});

export type CareerMapDraft = z.infer<typeof careerMapDraftSchema>;
