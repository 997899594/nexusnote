import type { CareerNodeState, VisibleSkillTreeNode } from "@/lib/career-tree/types";

export interface VisibleTreeMetrics {
  total: number;
  mastered: number;
  inProgress: number;
  ready: number;
  locked: number;
  averageProgress: number;
}

export interface CurrentDirectionProjection {
  directionKey: string;
  title: string;
  summary: string;
  confidence: number;
  whyThisDirection: string;
  supportingCoursesCount: number;
  supportingChaptersCount: number;
}

export interface FocusSnapshotProjection {
  directionKey: string | null;
  nodeId: string | null;
  anchorRef: string | null;
  title: string;
  summary: string;
  progress: number;
  state: CareerNodeState;
  whyThisDirection: string | null;
  score: number | null;
  node: VisibleSkillTreeNode | null;
}

export interface ProfileSnapshotProjection {
  recommendedDirectionKey: string | null;
  selectedDirectionKey: string | null;
  treesCount: number;
  currentDirection: CurrentDirectionProjection | null;
  metrics: VisibleTreeMetrics | null;
  focus: VisibleSkillTreeNode | null;
}
