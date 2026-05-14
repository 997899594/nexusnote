import { z } from "zod";

export const researchPlanTaskSchema = z.object({
  id: z.string().trim().min(1).max(40),
  title: z.string().trim().min(1).max(120),
  query: z.string().trim().min(1).max(240),
  focus: z.string().trim().min(1).max(240),
});

export const researchPlanSchema = z.object({
  reportTitle: z.string().trim().min(1).max(160),
  summaryGoal: z.string().trim().min(1).max(240),
  tasks: z.array(researchPlanTaskSchema).min(2).max(4),
});

export const researchWorkerSummarySchema = z.object({
  summary: z.string().trim().min(1).max(800),
  findings: z.array(z.string().trim().min(1).max(240)).min(2).max(5),
  evidenceGaps: z.array(z.string().trim().min(1).max(240)).max(3),
});

export interface ResearchSource {
  title: string;
  url: string;
  domain: string;
  snippet: string;
}

export interface ResearchWorkerTask {
  id: string;
  title: string;
  query: string;
  focus: string;
}

export interface ResearchWorkerResult {
  task: ResearchWorkerTask;
  findings: string[];
  summary: string;
  evidenceGaps: string[];
  sources: ResearchSource[];
}

export interface BackgroundResearchReport {
  reportTitle: string;
  reportMarkdown: string;
  sourceCount: number;
  completedAt: string;
  citations: ResearchCitation[];
}

export const backgroundResearchSessionStateSchema = z.enum([
  "queued",
  "running",
  "cancel_requested",
  "completed",
  "failed",
  "canceled",
]);

export const researchTaskStatusSchema = z.enum([
  "queued",
  "running",
  "completed",
  "failed",
  "canceled",
]);

export const backgroundResearchProgressSchema = z.object({
  stage: z.string().trim().min(1),
  message: z.string().trim().min(1),
  totalTasks: z.number().int().min(0).optional(),
  completedTasks: z.number().int().min(0).optional(),
  activeTaskKey: z.string().trim().min(1).optional(),
  updatedAt: z.string().trim().min(1),
});

export interface ResearchCitation {
  id: string;
  title: string;
  url: string;
  domain: string;
  snippets: string[];
  taskKeys: string[];
}

export interface ResearchTaskSnapshot {
  id: string;
  taskKey: string;
  title: string;
  query: string;
  focus: string;
  ordinal: number;
  status: ResearchTaskStatus;
  summary: string | null;
  findings: string[];
  evidenceGaps: string[];
  errorMessage: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  sources: ResearchSource[];
}

export interface ResearchRunSnapshot {
  id: string;
  jobType: "run_background_research";
  status: ResearchRunStatus;
  userPrompt: string;
  routeProfile: string | null;
  workerTransport: string;
  progress: BackgroundResearchProgress | null;
  report: BackgroundResearchReport | null;
  tasks: ResearchTaskSnapshot[];
  citations: ResearchCitation[];
  errorCode: string | null;
  errorMessage: string | null;
  cancelRequestedAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  canCancel: boolean;
  canRetry: boolean;
}

export const backgroundResearchMetadataSchema = z.object({
  runId: z.string().trim().min(1),
  type: z.literal("run_background_research"),
  state: backgroundResearchSessionStateSchema,
  enqueuedAt: z.string().trim().min(1),
  startedAt: z.string().trim().min(1).optional(),
  completedAt: z.string().trim().min(1).optional(),
  failedReason: z.string().trim().min(1).optional(),
});

export type BackgroundResearchMetadata = z.infer<typeof backgroundResearchMetadataSchema>;
export type ResearchRunStatus = z.infer<typeof backgroundResearchSessionStateSchema>;
export type ResearchTaskStatus = z.infer<typeof researchTaskStatusSchema>;
export type BackgroundResearchProgress = z.infer<typeof backgroundResearchProgressSchema>;

export function parseBackgroundResearchMetadata(
  metadata: unknown,
): BackgroundResearchMetadata | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const candidate = (metadata as Record<string, unknown>).backgroundResearch;
  const parsed = backgroundResearchMetadataSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}
