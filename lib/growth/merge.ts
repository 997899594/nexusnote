import {
  IN_PROGRESS_THRESHOLD,
  MASTERED_EVIDENCE_THRESHOLD,
  MASTERED_PROGRESS_THRESHOLD,
  READY_PREREQ_PROGRESS_THRESHOLD,
} from "@/lib/growth/constants";
import type { MergeCandidateSet } from "@/lib/growth/retrieve-merge-candidates";

export interface MergePlannerEvidenceBatchItem {
  id: string;
  title: string;
  summary: string;
  confidence: number;
  chapterKeys: string[];
  evidenceSnippets: string[];
}

export interface PrerequisiteEdgeDecision {
  from: string;
  to: string;
  confidence: number;
}

export type MergePlannerOutput = {
  decisions: Array<
    | {
        action: "attach";
        targetNodeId: string;
        evidenceIds: string[];
        confidence: number;
        reason: string;
      }
    | {
        action: "create";
        tempNodeRef: string;
        newNode: {
          canonicalLabel: string;
          summary?: string | null;
        };
        evidenceIds: string[];
        confidence: number;
        reason: string;
      }
  >;
  prerequisiteEdges: PrerequisiteEdgeDecision[];
};

function clampConfidence(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function planDeterministicGrowthMerge(params: {
  candidateContext: MergeCandidateSet;
  evidenceBatch: MergePlannerEvidenceBatchItem[];
}): MergePlannerOutput {
  const candidatesByEvidenceId = new Map(
    params.candidateContext.evidenceCandidates.map((item) => [
      item.evidenceId,
      item.candidateNodeIds,
    ]),
  );

  return {
    decisions: params.evidenceBatch.map((item, index) => {
      const targetNodeId = candidatesByEvidenceId.get(item.id)?.[0];
      const confidence = clampConfidence(item.confidence);

      if (targetNodeId) {
        return {
          action: "attach" as const,
          targetNodeId,
          evidenceIds: [item.id],
          confidence,
          reason: "candidate-context-match",
        };
      }

      return {
        action: "create" as const,
        tempNodeRef: `new:${index}:${item.id}`,
        newNode: {
          canonicalLabel: item.title.trim(),
          summary: item.summary.trim() || null,
        },
        evidenceIds: [item.id],
        confidence,
        reason: "no-candidate-context-match",
      };
    }),
    prerequisiteEdges: [],
  };
}

export interface AggregationInput {
  chapterCompletionRatios: Array<{ ratio: number; confidence: number }>;
  fallbackCourseProgressRatios: Array<{ ratio: number; confidence: number }>;
  courseCount: number;
  chapterCount: number;
  repeatedEvidenceCount: number;
  prerequisiteProgresses: number[];
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function computeProgress(input: AggregationInput): number {
  const sources =
    input.chapterCompletionRatios.length > 0
      ? input.chapterCompletionRatios
      : input.fallbackCourseProgressRatios;

  if (sources.length === 0) {
    return 0;
  }

  const totalWeight = sources.reduce((sum, item) => sum + item.confidence, 0);
  if (totalWeight <= 0) {
    return 0;
  }

  const weightedValue = sources.reduce((sum, item) => sum + item.ratio * item.confidence, 0);
  return clampPercent(weightedValue / totalWeight);
}

export function computeEvidenceScore(input: AggregationInput): number {
  const support =
    input.chapterCompletionRatios.reduce((sum, item) => sum + item.confidence * 20, 0) +
    input.fallbackCourseProgressRatios.reduce((sum, item) => sum + item.confidence * 10, 0);
  return clampPercent(Math.min(100, support));
}

export function computeMasteryScore(progress: number, input: AggregationInput): number {
  return clampPercent(
    progress * 0.7 +
      Math.min(20, input.courseCount * 5) +
      Math.min(10, input.repeatedEvidenceCount * 2),
  );
}

export function resolveGrowthNodeState(
  progress: number,
  evidenceScore: number,
  prerequisiteProgresses: number[],
): "mastered" | "in_progress" | "ready" | "locked" {
  if (progress >= MASTERED_PROGRESS_THRESHOLD && evidenceScore >= MASTERED_EVIDENCE_THRESHOLD) {
    return "mastered";
  }

  if (progress >= IN_PROGRESS_THRESHOLD) {
    return "in_progress";
  }

  const allPrerequisitesReady =
    prerequisiteProgresses.length === 0 ||
    prerequisiteProgresses.every((value) => value >= READY_PREREQ_PROGRESS_THRESHOLD);

  return allPrerequisitesReady ? "ready" : "locked";
}

export function validateMergePlannerOutput(params: {
  output: MergePlannerOutput;
  allowedTargetNodeIds: Set<string>;
  allowedEvidenceIds: Set<string>;
  maxNewNodes?: number;
  maxEdges?: number;
}): MergePlannerOutput {
  const maxNewNodes = params.maxNewNodes ?? 20;
  const maxEdges = params.maxEdges ?? 40;

  let createdCount = 0;
  const validDecisions = params.output.decisions.filter((decision) => {
    const evidenceIdsValid = decision.evidenceIds.every((id) => params.allowedEvidenceIds.has(id));
    if (!evidenceIdsValid) {
      return false;
    }

    if (decision.action === "attach") {
      return params.allowedTargetNodeIds.has(decision.targetNodeId);
    }

    createdCount += 1;
    return createdCount <= maxNewNodes;
  });

  const validEdges = params.output.prerequisiteEdges
    .filter((edge) => edge.from !== edge.to)
    .slice(0, maxEdges);

  return {
    decisions: validDecisions,
    prerequisiteEdges: filterCyclicEdges(validEdges),
  };
}

function filterCyclicEdges(
  edges: Array<{ from: string; to: string; confidence: number }>,
): Array<{ from: string; to: string; confidence: number }> {
  const accepted: Array<{ from: string; to: string; confidence: number }> = [];
  const adjacency = new Map<string, Set<string>>();

  function createsCycle(from: string, to: string): boolean {
    const stack = [to];
    const visited = new Set<string>();

    while (stack.length > 0) {
      const current = stack.pop();
      if (!current || visited.has(current)) {
        continue;
      }

      if (current === from) {
        return true;
      }

      visited.add(current);
      for (const next of adjacency.get(current) ?? []) {
        stack.push(next);
      }
    }

    return false;
  }

  for (const edge of edges) {
    if (createsCycle(edge.from, edge.to)) {
      continue;
    }

    accepted.push(edge);
    const next = adjacency.get(edge.from) ?? new Set<string>();
    next.add(edge.to);
    adjacency.set(edge.from, next);
  }

  return accepted;
}
