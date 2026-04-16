import type { InterviewOutline, InterviewState } from "./schemas";

function hasContent(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function validateOutlineForState(
  outline: InterviewOutline,
  _state: InterviewState,
): { valid: true } | { valid: false; reason: string } {
  if (!hasContent(outline.title)) {
    return {
      valid: false,
      reason: "课程标题缺失，暂时不能进入课程草案预览。",
    };
  }

  if (outline.chapters.length < 5) {
    return {
      valid: false,
      reason: "当前大纲章节过少，先补成完整课程结构。",
    };
  }

  if (outline.chapters.some((chapter) => chapter.sections.length < 4)) {
    return {
      valid: false,
      reason: "有章节小节不足，先补齐完整结构再展示。",
    };
  }

  return { valid: true };
}
