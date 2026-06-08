import type { TextAnchor } from "@/lib/learning/text-anchors";

export interface Annotation {
  id: string;
  type: "highlight" | "note";
  anchor: TextAnchor;
  color?: string;
  noteContent?: string;
  createdAt: string;
}

export async function persistSectionAnnotations(params: {
  sectionId: string;
  annotations: Annotation[];
}): Promise<void> {
  const response = await fetch("/api/learn/annotations", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    throw new Error("Failed to persist section annotations.");
  }
}
