import type { Annotation } from "@/hooks/useAnnotations";

export interface CourseCaptureInput {
  courseTitle: string;
  sectionTitle: string;
  selectionText: string;
  noteContent?: string;
}

function truncate(value: string, max: number) {
  return value.length > max ? `${value.slice(0, max).trim()}...` : value;
}

export function buildCapturedNoteTitle({
  sectionTitle,
  selectionText,
}: Pick<CourseCaptureInput, "sectionTitle" | "selectionText">) {
  const compactSelection = selectionText.replace(/\s+/g, " ").trim();
  const selectionPreview = truncate(compactSelection, 28);
  return truncate(`${sectionTitle} · ${selectionPreview}`, 80);
}

export function buildCapturedNotePlainText({
  courseTitle,
  sectionTitle,
  selectionText,
  noteContent,
}: CourseCaptureInput) {
  const blocks = [
    `课程：${courseTitle}`,
    `章节：${sectionTitle}`,
    "",
    "摘录：",
    selectionText.trim(),
  ];

  if (noteContent?.trim()) {
    blocks.push("", "我的想法：", noteContent.trim());
  }

  return blocks.join("\n");
}

export function serializeCaptureAnchor(anchor: Annotation["anchor"]) {
  return {
    textContent: anchor.textContent,
    startOffset: anchor.startOffset,
    endOffset: anchor.endOffset,
  };
}
