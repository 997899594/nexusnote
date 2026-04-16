import type { InterviewOutline, InterviewState } from "./schemas";

function hasContent(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function tokenize(value: string | null | undefined) {
  if (!hasContent(value)) {
    return [];
  }

  const normalizedValue = value.trim().toLowerCase();

  return normalizedValue
    .toLowerCase()
    .split(/[\s,，。；;、()（）\-_/]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function shouldEnforceSemanticOverlap(tokens: string[]) {
  return tokens.some((token) => token.length >= 4) || tokens.length >= 2;
}

export function validateOutlineForState(
  outline: InterviewOutline,
  state: InterviewState,
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

  const outlineText = [
    outline.title,
    outline.description,
    outline.learningOutcome,
    outline.targetAudience,
    ...outline.chapters.flatMap((chapter) => [chapter.title, chapter.description]),
    ...outline.chapters.flatMap((chapter) =>
      chapter.sections.flatMap((section) => [section.title, section.description]),
    ),
  ]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();

  const topicTokens = tokenize(state.topic);
  if (
    shouldEnforceSemanticOverlap(topicTokens) &&
    !topicTokens.some((token) => outlineText.includes(token))
  ) {
    return {
      valid: false,
      reason: "当前大纲和用户想学的主题贴合度不够，先进一步对齐课程方向。",
    };
  }

  return { valid: true };
}
