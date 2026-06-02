import type { ResearchEvidenceSnapshot } from "@/lib/ai/research/evidence-snapshot";
import type { ResearchEvidenceProgress } from "@/lib/ai/research/web-research";

export type InterviewResearchEvent =
  | {
      kind: "started";
      runId: string;
      createdAt: string;
      query: string;
      queries: string[];
      freshnessWindowDays: 30 | 90 | 180;
    }
  | {
      kind: "progress";
      runId: string;
      createdAt: string;
      progress: ResearchEvidenceProgress;
    }
  | {
      kind: "completed";
      runId: string;
      createdAt: string;
      evidence: ResearchEvidenceSnapshot;
    };

export function createInterviewResearchRunId(): string {
  return `interview-research-${crypto.randomUUID()}`;
}

export function createInterviewResearchStartedEvent(params: {
  runId: string;
  query: string;
  queries: string[];
  freshnessWindowDays: 30 | 90 | 180;
}): InterviewResearchEvent {
  return {
    kind: "started",
    runId: params.runId,
    createdAt: new Date().toISOString(),
    query: params.query,
    queries: params.queries,
    freshnessWindowDays: params.freshnessWindowDays,
  };
}

export function createInterviewResearchProgressEvent(params: {
  runId: string;
  progress: ResearchEvidenceProgress;
}): InterviewResearchEvent {
  return {
    kind: "progress",
    runId: params.runId,
    createdAt: new Date().toISOString(),
    progress: params.progress,
  };
}

export function createInterviewResearchCompletedEvent(params: {
  runId: string;
  evidence: ResearchEvidenceSnapshot;
}): InterviewResearchEvent {
  return {
    kind: "completed",
    runId: params.runId,
    createdAt: new Date().toISOString(),
    evidence: params.evidence,
  };
}
