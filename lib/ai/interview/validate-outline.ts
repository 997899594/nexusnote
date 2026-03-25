import type { InterviewOutline, InterviewState } from "./schemas";

function hasContent(value: string | null | undefined) {
  return typeof value === "string" && value.trim().length > 0;
}

export function validateOutlineForState(
  outline: InterviewOutline,
  state: InterviewState,
): { valid: true } | { valid: false; reason: string } {
  if (
    !hasContent(outline.title) ||
    !hasContent(outline.description) ||
    !hasContent(outline.learningOutcome)
  ) {
    return {
      valid: false,
      reason: "课程标题、描述或学习成果缺失，暂时不能进入课程创建。",
    };
  }

  if (outline.chapters.length < 2) {
    return {
      valid: false,
      reason: "当前大纲章节过少，先补充一轮再生成更完整的课程。",
    };
  }

  if (outline.chapters.some((chapter) => chapter.sections.length === 0)) {
    return {
      valid: false,
      reason: "有章节还没有小节，先补充课程结构。",
    };
  }

  if (state.goal && outline.title.length > 0) {
    const goalText = state.goal.toLowerCase();
    const titleText = outline.title.toLowerCase();
    const hasKeywordOverlap = goalText
      .split(/[\s,，。；;、]+/)
      .filter((token) => token.length >= 2)
      .some((token) => titleText.includes(token));

    if (!hasKeywordOverlap && state.mode === "discover") {
      return {
        valid: false,
        reason: "当前课程标题和用户目标贴合度不够，先进一步收敛方向。",
      };
    }
  }

  return { valid: true };
}
