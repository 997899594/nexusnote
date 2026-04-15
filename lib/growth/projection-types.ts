import { z } from "zod";
import { CAREER_PROJECTION_SCHEMA_VERSION } from "@/lib/growth/constants";
import {
  type GrowthNodeState,
  growthNodeStateSchema,
  type VisibleSkillTreeNode,
  visibleSkillTreeNodeSchema,
} from "@/lib/growth/types";
import type { KnowledgeInsight } from "@/lib/knowledge/insights";

export const visibleTreeMetricsSchema = z.object({
  total: z.number().int().nonnegative(),
  mastered: z.number().int().nonnegative(),
  inProgress: z.number().int().nonnegative(),
  ready: z.number().int().nonnegative(),
  locked: z.number().int().nonnegative(),
  averageProgress: z.number().int().min(0).max(100),
});

export type VisibleTreeMetrics = z.infer<typeof visibleTreeMetricsSchema>;

export const currentDirectionProjectionSchema = z.object({
  directionKey: z.string(),
  title: z.string(),
  summary: z.string(),
  confidence: z.number().min(0).max(1),
  whyThisDirection: z.string(),
  supportingCoursesCount: z.number().int().nonnegative(),
  supportingChaptersCount: z.number().int().nonnegative(),
});

export type CurrentDirectionProjection = z.infer<typeof currentDirectionProjectionSchema>;

export const focusSnapshotPayloadSchema = z.object({
  schemaVersion: z.literal(CAREER_PROJECTION_SCHEMA_VERSION),
  directionKey: z.string().nullable(),
  treeTitle: z.string().nullable(),
  whyThisDirection: z.string().nullable(),
  node: visibleSkillTreeNodeSchema.nullable(),
});

export type FocusSnapshotPayload = z.infer<typeof focusSnapshotPayloadSchema>;

export interface FocusSnapshotProjection {
  directionKey: string | null;
  nodeId: string | null;
  anchorRef: string | null;
  title: string;
  summary: string;
  progress: number;
  state: GrowthNodeState;
  whyThisDirection: string | null;
  node: VisibleSkillTreeNode | null;
}

export type GrowthFocusSummary = Pick<
  FocusSnapshotProjection,
  "directionKey" | "title" | "summary" | "progress" | "state"
>;

export type GrowthInsightSummary = Pick<
  KnowledgeInsight,
  "id" | "kind" | "title" | "summary" | "confidence"
>;

export const profileSnapshotPayloadSchema = z.object({
  schemaVersion: z.literal(CAREER_PROJECTION_SCHEMA_VERSION),
  recommendedDirectionKey: z.string().nullable(),
  selectedDirectionKey: z.string().nullable(),
  treesCount: z.number().int().nonnegative(),
  currentDirection: currentDirectionProjectionSchema.nullable(),
  metrics: visibleTreeMetricsSchema.nullable(),
  focus: visibleSkillTreeNodeSchema.nullable(),
});

export type ProfileSnapshotPayload = z.infer<typeof profileSnapshotPayloadSchema>;

export interface ProfileSnapshotProjection {
  recommendedDirectionKey: string | null;
  selectedDirectionKey: string | null;
  treesCount: number;
  currentDirection: CurrentDirectionProjection | null;
  metrics: VisibleTreeMetrics | null;
  focus: VisibleSkillTreeNode | null;
}

export function normalizeProjectionState(value: string): GrowthNodeState {
  const parsed = growthNodeStateSchema.safeParse(value);
  return parsed.success ? parsed.data : "ready";
}
