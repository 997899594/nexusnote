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

export async function persistCurrentChapter(params: {
  target: LearningProgressTarget;
  currentChapter: number;
}): Promise<void> {
  const response = await fetch(progressApiPath(params.target), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(progressPayload(params.target, { currentChapter: params.currentChapter })),
  });

  if (!response.ok) {
    throw new Error("Failed to persist current chapter.");
  }
}

export async function persistCompletedSection(params: {
  target: LearningProgressTarget;
  sectionNodeId: string;
}): Promise<void> {
  const response = await fetch(progressApiPath(params.target), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(progressPayload(params.target, { sectionNodeId: params.sectionNodeId })),
  });

  if (!response.ok) {
    throw new Error("Failed to persist completed section.");
  }
}
