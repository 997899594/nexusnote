export type LearningMomentumStatus = "not_started" | "in_progress" | "completed";

export interface LearningMomentumSection {
  nodeId: string;
  title: string;
  chapterIndex: number;
  sectionIndex: number;
}

export interface LearningMomentumProjection {
  status: LearningMomentumStatus;
  progressPercent: number;
  completedSectionCount: number;
  totalSectionCount: number;
  remainingMinutes: number | null;
  nextSection: LearningMomentumSection | null;
}

export function projectLearningMomentum(input: {
  sections: LearningMomentumSection[];
  completedSections?: string[] | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
  estimatedMinutes?: number | null;
}): LearningMomentumProjection {
  const completedSet = new Set(input.completedSections ?? []);
  const completedSectionCount = input.sections.reduce(
    (count, section) => count + (completedSet.has(section.nodeId) ? 1 : 0),
    0,
  );
  const totalSectionCount = input.sections.length;
  const isComplete = totalSectionCount > 0 && completedSectionCount === totalSectionCount;
  const status: LearningMomentumStatus = isComplete
    ? "completed"
    : input.startedAt || completedSectionCount > 0
      ? "in_progress"
      : "not_started";
  const progressPercent =
    totalSectionCount > 0 ? Math.round((completedSectionCount / totalSectionCount) * 100) : 0;
  const remainingRatio =
    totalSectionCount > 0 ? (totalSectionCount - completedSectionCount) / totalSectionCount : 0;
  const remainingMinutes = input.estimatedMinutes
    ? Math.max(0, Math.ceil(input.estimatedMinutes * remainingRatio))
    : null;

  return {
    status,
    progressPercent,
    completedSectionCount,
    totalSectionCount,
    remainingMinutes,
    nextSection:
      status === "completed"
        ? null
        : (input.sections.find((section) => !completedSet.has(section.nodeId)) ?? null),
  };
}
