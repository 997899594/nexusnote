export type LearningProgressTarget =
  | { kind: "course"; id: string }
  | { kind: "publication"; slug: string };

function progressApiPath(target: LearningProgressTarget): string {
  if (target.kind === "publication") {
    return `/api/public/courses/${encodeURIComponent(target.slug)}/progress`;
  }

  return "/api/learn/progress";
}

function progressPayload(
  target: LearningProgressTarget,
  payload: Record<string, unknown>,
): Record<string, unknown> {
  if (target.kind === "course") {
    return { courseId: target.id, ...payload };
  }

  return payload;
}

export async function persistCompletedSection(params: {
  target: LearningProgressTarget;
  sectionNodeId: string;
}): Promise<{
  completedSections: string[];
  completedChapters: number[];
  courseCompleted: boolean;
}> {
  const response = await fetch(progressApiPath(params.target), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(progressPayload(params.target, { sectionNodeId: params.sectionNodeId })),
  });

  if (!response.ok) {
    throw new Error("Failed to persist completed section.");
  }

  return response.json();
}

export async function recordCourseOpened(courseId: string, activityId: string): Promise<void> {
  const response = await fetch("/api/learn/activity", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ courseId, activityId }),
  });

  if (!response.ok) {
    throw new Error("Failed to record course activity.");
  }
}
