import type { KnowledgeInsight } from "@/lib/knowledge/insights";

export const KNOWLEDGE_INSIGHT_KIND_LABELS: Record<KnowledgeInsight["kind"], string> = {
  theme: "主题",
  strength: "优势",
  gap: "待补",
  trajectory: "走向",
  recommendation_reason: "依据",
};

interface BuildKnowledgeExcerptOptions {
  emptyText?: string;
  maxLength?: number;
}

export function getKnowledgeInsightKindLabel(kind: KnowledgeInsight["kind"]): string {
  return KNOWLEDGE_INSIGHT_KIND_LABELS[kind];
}

export function buildKnowledgeExcerpt(
  plainText: string | null,
  fallback: string | null,
  options: BuildKnowledgeExcerptOptions = {},
): string {
  const { emptyText = "相关知识材料会显示在这里。", maxLength = 120 } = options;
  const raw = (plainText || fallback || "").replace(/\s+/g, " ").trim();

  if (!raw) {
    return emptyText;
  }

  return raw.length > maxLength ? `${raw.slice(0, maxLength).trim()}...` : raw;
}
