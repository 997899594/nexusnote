import { createHash } from "node:crypto";
import type { KnowledgeInsightKind } from "./types";

export interface InsightDerivationEvidenceRow {
  id: string;
  title: string;
  summary: string;
  confidence: number | string;
  kind: string;
  sourceType: string;
}

export interface InsightDerivationSkillNode {
  id: string;
  canonicalLabel: string;
  progress: number;
  state: string;
  evidenceScore: number;
}

export interface InsightDerivationRecentEvent {
  id: string;
  kind: string;
  sourceType: string;
}

export interface InsightDerivationFocusSnapshot {
  directionKey: string | null;
  nodeId: string | null;
  title: string;
  summary: string;
  progress: number;
  state: string;
}

export interface DerivedKnowledgeInsight {
  kind: KnowledgeInsightKind;
  title: string;
  summary: string;
  confidence: number;
  evidenceIds: string[];
  metadata: Record<string, unknown>;
}

export interface DeriveKnowledgeInsightsInput {
  evidenceRows: InsightDerivationEvidenceRow[];
  skillNodes: InsightDerivationSkillNode[];
  recentEvents: InsightDerivationRecentEvent[];
  focusSnapshot: InsightDerivationFocusSnapshot | null;
}

interface ThemeGroup {
  title: string;
  summary: string;
  confidenceSum: number;
  representativeConfidence: number;
  evidenceIds: string[];
  sourceTypes: Set<string>;
  evidenceKinds: Set<string>;
}

function clampConfidence(value: number, fallback = 0.5): number {
  if (!Number.isFinite(value)) {
    return Math.round(fallback * 1000) / 1000;
  }

  return Math.round(Math.min(1, Math.max(0, value)) * 1000) / 1000;
}

function normalizeLabel(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function describeSourceType(sourceType: string): string {
  switch (sourceType) {
    case "course":
      return "课程";
    case "course_section":
      return "课程内容";
    case "conversation":
      return "对话";
    case "note":
      return "笔记";
    case "highlight":
      return "高亮";
    case "capture":
      return "捕获";
    case "growth_preference":
      return "方向选择";
    default:
      return sourceType;
  }
}

function buildTrajectoryTitle(rankedSources: Array<[string, number]>): string {
  const labels = rankedSources
    .slice(0, 3)
    .map(([sourceType]) => describeSourceType(sourceType))
    .filter((label) => label.length > 0);
  const fallbackLabel = rankedSources[0]?.[0] ?? "signal";
  return `${labels.join(" · ") || fallbackLabel}轨迹`;
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right, "zh-Hans-CN");
}

function normalizeEvidenceRows(rows: InsightDerivationEvidenceRow[]) {
  return [...rows]
    .map((row) => ({
      ...row,
      confidence: Number(row.confidence),
    }))
    .sort((left, right) => {
      const labelCompare = compareText(normalizeLabel(left.title), normalizeLabel(right.title));
      if (labelCompare !== 0) {
        return labelCompare;
      }

      if (right.confidence !== left.confidence) {
        return right.confidence - left.confidence;
      }

      return compareText(left.id, right.id);
    });
}

function normalizeSkillNodes(nodes: InsightDerivationSkillNode[]) {
  return [...nodes].sort((left, right) => {
    if (right.progress !== left.progress) {
      return right.progress - left.progress;
    }

    if (right.evidenceScore !== left.evidenceScore) {
      return right.evidenceScore - left.evidenceScore;
    }

    const labelCompare = compareText(left.canonicalLabel, right.canonicalLabel);
    if (labelCompare !== 0) {
      return labelCompare;
    }

    return compareText(left.id, right.id);
  });
}

function normalizeRecentEvents(events: InsightDerivationRecentEvent[]) {
  return [...events].sort((left, right) => {
    const sourceCompare = compareText(left.sourceType, right.sourceType);
    if (sourceCompare !== 0) {
      return sourceCompare;
    }

    const kindCompare = compareText(left.kind, right.kind);
    if (kindCompare !== 0) {
      return kindCompare;
    }

    return compareText(left.id, right.id);
  });
}

function buildThemeInsights(
  evidenceRows: InsightDerivationEvidenceRow[],
): DerivedKnowledgeInsight[] {
  const groupedThemes = new Map<string, ThemeGroup>();

  for (const row of normalizeEvidenceRows(evidenceRows)) {
    const key = normalizeLabel(row.title);
    if (!key) {
      continue;
    }

    const confidence = Number(row.confidence);
    const current = groupedThemes.get(key) ?? {
      title: row.title,
      summary: row.summary,
      confidenceSum: 0,
      representativeConfidence: confidence,
      evidenceIds: [],
      sourceTypes: new Set<string>(),
      evidenceKinds: new Set<string>(),
    };

    if (
      confidence > current.representativeConfidence ||
      (confidence === current.representativeConfidence && compareText(row.title, current.title) < 0)
    ) {
      current.title = row.title;
      current.summary = row.summary;
      current.representativeConfidence = confidence;
    }

    current.confidenceSum += confidence;
    current.evidenceIds.push(row.id);
    current.sourceTypes.add(row.sourceType);
    current.evidenceKinds.add(row.kind);
    groupedThemes.set(key, current);
  }

  return [...groupedThemes.values()]
    .sort((left, right) => {
      if (right.confidenceSum !== left.confidenceSum) {
        return right.confidenceSum - left.confidenceSum;
      }

      return compareText(left.title, right.title);
    })
    .slice(0, 3)
    .map((theme) => ({
      kind: "theme",
      title: theme.title,
      summary: theme.summary || "这是近期被反复强化的知识主题。",
      confidence: clampConfidence(
        (theme.confidenceSum / Math.max(1, theme.evidenceIds.length)) *
          Math.min(1, 0.75 + theme.evidenceIds.length * 0.1),
        0.6,
      ),
      evidenceIds: theme.evidenceIds,
      metadata: {
        evidenceIds: theme.evidenceIds,
        sourceTypes: [...theme.sourceTypes].sort(compareText),
        evidenceKinds: [...theme.evidenceKinds].sort(compareText),
      },
    }));
}

function buildStrengthInsights(
  skillNodes: InsightDerivationSkillNode[],
): DerivedKnowledgeInsight[] {
  return normalizeSkillNodes(skillNodes)
    .filter((node) => node.progress >= 70)
    .slice(0, 2)
    .map((node) => ({
      kind: "strength",
      title: node.canonicalLabel,
      summary:
        node.state === "mastered"
          ? "这条能力分支已经形成稳定掌握。"
          : "这条能力分支正在持续稳定生长。",
      confidence: clampConfidence(Math.max(node.progress, 70) / 100, 0.7),
      evidenceIds: [],
      metadata: {
        nodeId: node.id,
        progress: node.progress,
        state: node.state,
        evidenceScore: node.evidenceScore,
      },
    }));
}

function buildGapInsights(skillNodes: InsightDerivationSkillNode[]): DerivedKnowledgeInsight[] {
  return normalizeSkillNodes(skillNodes)
    .filter(
      (node) => (node.state === "ready" || node.state === "locked") && node.evidenceScore >= 20,
    )
    .sort((left, right) => {
      if (right.evidenceScore !== left.evidenceScore) {
        return right.evidenceScore - left.evidenceScore;
      }

      return compareText(left.canonicalLabel, right.canonicalLabel);
    })
    .slice(0, 2)
    .map((node) => ({
      kind: "gap",
      title: node.canonicalLabel,
      summary:
        node.state === "locked"
          ? "这条能力分支已有明显信号，但前置能力还没完全打开。"
          : "这条能力分支已经有基础证据，值得优先推进。",
      confidence: clampConfidence(Math.max(node.evidenceScore, 35) / 100, 0.55),
      evidenceIds: [],
      metadata: {
        nodeId: node.id,
        progress: node.progress,
        state: node.state,
        evidenceScore: node.evidenceScore,
      },
    }));
}

function buildTrajectoryInsight(
  recentEvents: InsightDerivationRecentEvent[],
): DerivedKnowledgeInsight[] {
  if (recentEvents.length === 0) {
    return [];
  }

  const sourceBreakdown = new Map<string, number>();
  const eventKinds = new Set<string>();

  for (const event of normalizeRecentEvents(recentEvents)) {
    sourceBreakdown.set(event.sourceType, (sourceBreakdown.get(event.sourceType) ?? 0) + 1);
    eventKinds.add(event.kind);
  }

  const rankedSources = [...sourceBreakdown.entries()].sort((left, right) => {
    if (right[1] !== left[1]) {
      return right[1] - left[1];
    }

    return compareText(left[0], right[0]);
  });
  const sourceSummary = rankedSources
    .slice(0, 3)
    .map(([sourceType, count]) => `${describeSourceType(sourceType)} ${count} 条`)
    .join("、");

  return [
    {
      kind: "trajectory",
      title: buildTrajectoryTitle(rankedSources),
      summary: `最近的知识输入主要来自${sourceSummary}，系统会据此重排当前成长判断。`,
      confidence: clampConfidence(0.55 + recentEvents.length * 0.03, 0.65),
      evidenceIds: [],
      metadata: {
        recentEventIds: normalizeRecentEvents(recentEvents).map((event) => event.id),
        sourceBreakdown: Object.fromEntries(rankedSources),
        eventKinds: [...eventKinds].sort(compareText),
      },
    },
  ];
}

function buildRecommendationInsight(
  focusSnapshot: InsightDerivationFocusSnapshot | null,
): DerivedKnowledgeInsight[] {
  if (!focusSnapshot) {
    return [];
  }

  return [
    {
      kind: "recommendation_reason",
      title: focusSnapshot.title,
      summary: focusSnapshot.summary || "这是系统当前最建议优先推进的能力焦点。",
      confidence: clampConfidence(Math.max(focusSnapshot.progress, 45) / 100, 0.72),
      evidenceIds: [],
      metadata: {
        directionKey: focusSnapshot.directionKey,
        nodeId: focusSnapshot.nodeId,
        state: focusSnapshot.state,
        progress: focusSnapshot.progress,
      },
    },
  ];
}

export function deriveKnowledgeInsights(
  input: DeriveKnowledgeInsightsInput,
): DerivedKnowledgeInsight[] {
  return [
    ...buildThemeInsights(input.evidenceRows),
    ...buildStrengthInsights(input.skillNodes),
    ...buildGapInsights(input.skillNodes),
    ...buildTrajectoryInsight(input.recentEvents),
    ...buildRecommendationInsight(input.focusSnapshot),
  ];
}

export function hashKnowledgeInsightInputs(input: DeriveKnowledgeInsightsInput): string {
  const normalized = {
    evidenceRows: normalizeEvidenceRows(input.evidenceRows).map((row) => ({
      ...row,
      confidence: Number(row.confidence),
    })),
    skillNodes: normalizeSkillNodes(input.skillNodes),
    recentEvents: normalizeRecentEvents(input.recentEvents),
    focusSnapshot: input.focusSnapshot,
  };

  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}
