import { z } from "zod";
import { CAREER_TREE_SCHEMA_VERSION } from "@/lib/career-tree/constants";

export const careerTreeNodeStateSchema = z.enum(["mastered", "in_progress", "ready", "locked"]);

export type CareerTreeNodeState = z.infer<typeof careerTreeNodeStateSchema>;

export const supportingCourseRefSchema = z.object({
  courseId: z.string(),
  title: z.string(),
});

export type SupportingCourseRef = z.infer<typeof supportingCourseRefSchema>;

export const supportingChapterRefSchema = z.object({
  courseId: z.string(),
  chapterKey: z.string(),
  chapterIndex: z.number().int().nonnegative(),
  title: z.string(),
});

export type SupportingChapterRef = z.infer<typeof supportingChapterRefSchema>;

export const visibleSkillTreeNodeSchema: z.ZodType<VisibleSkillTreeNode> = z.lazy(() =>
  z.object({
    id: z.string(),
    anchorRef: z.string(),
    title: z.string(),
    summary: z.string(),
    progress: z.number().int().min(0).max(100),
    state: careerTreeNodeStateSchema,
    children: z.array(visibleSkillTreeNodeSchema),
    evidenceRefs: z.array(z.string()).optional(),
  }),
);

export interface VisibleSkillTreeNode {
  id: string;
  anchorRef: string;
  title: string;
  summary: string;
  progress: number;
  state: CareerTreeNodeState;
  children: VisibleSkillTreeNode[];
  evidenceRefs?: string[];
}

export const candidateCareerTreeSchema = z.object({
  directionKey: z.string(),
  title: z.string(),
  summary: z.string(),
  confidence: z.number().min(0).max(1),
  whyThisDirection: z.string(),
  supportingCourses: z.array(supportingCourseRefSchema),
  supportingChapters: z.array(supportingChapterRefSchema),
  tree: z.array(visibleSkillTreeNodeSchema),
});

export type CandidateCareerTree = z.infer<typeof candidateCareerTreeSchema>;

export const goldenPathSnapshotSchema = z.object({
  schemaVersion: z.literal(CAREER_TREE_SCHEMA_VERSION),
  status: z.enum(["empty", "pending", "ready"]),
  recommendedDirectionKey: z.string().nullable(),
  selectedDirectionKey: z.string().nullable(),
  trees: z.array(candidateCareerTreeSchema),
  generatedAt: z.string().nullable(),
});

export type GoldenPathSnapshot = z.infer<typeof goldenPathSnapshotSchema>;

export function createEmptyGoldenPathSnapshot(): GoldenPathSnapshot {
  return {
    schemaVersion: CAREER_TREE_SCHEMA_VERSION,
    status: "empty",
    recommendedDirectionKey: null,
    selectedDirectionKey: null,
    trees: [],
    generatedAt: null,
  };
}

export function createPendingGoldenPathSnapshot(
  selectedDirectionKey: string | null,
): GoldenPathSnapshot {
  return {
    schemaVersion: CAREER_TREE_SCHEMA_VERSION,
    status: "pending",
    recommendedDirectionKey: null,
    selectedDirectionKey,
    trees: [],
    generatedAt: null,
  };
}
