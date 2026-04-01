type UsageKind = "policy" | "workflow" | "provider" | "generic";

const POLICY_LABELS: Record<string, string> = {
  "interactive-fast": "交互快速",
  "structured-high-quality": "结构高质量",
  "search-enabled": "联网检索",
};

const WORKFLOW_LABELS: Record<string, string> = {
  "notes:tag-generation": "标签生成",
  "discover-skills": "技能发现",
  "ai-eval-judge": "AI 评测",
  "conversation-title-generation": "标题生成",
  "query-rewrite": "检索改写",
  "style-analysis": "风格分析",
  "interview-agent": "课程访谈",
  "generate-course-section": "课程章节生成",
};

const PROVIDER_LABELS: Record<string, string> = {
  "302.ai": "302.ai",
};

function humanizeIdentifier(value: string): string {
  return value
    .replace(/[:/_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getAIUsageLabel(value: string, kind: UsageKind = "generic"): string {
  const normalized = value.trim();
  if (!normalized) {
    return "未知";
  }

  if (kind === "policy") {
    return POLICY_LABELS[normalized] ?? humanizeIdentifier(normalized);
  }

  if (kind === "workflow") {
    return WORKFLOW_LABELS[normalized] ?? humanizeIdentifier(normalized);
  }

  if (kind === "provider") {
    return PROVIDER_LABELS[normalized] ?? normalized;
  }

  return (
    POLICY_LABELS[normalized] ??
    WORKFLOW_LABELS[normalized] ??
    PROVIDER_LABELS[normalized] ??
    humanizeIdentifier(normalized)
  );
}
