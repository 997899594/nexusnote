export async function persistCurrentChapter(params: {
  courseId: string;
  currentChapter: number;
}): Promise<void> {
  const response = await fetch("/api/learn/progress", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    throw new Error("Failed to persist current chapter.");
  }
}

export async function persistCompletedSection(params: {
  courseId: string;
  sectionNodeId: string;
}): Promise<void> {
  const response = await fetch("/api/learn/progress", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    throw new Error("Failed to persist completed section.");
  }
}
