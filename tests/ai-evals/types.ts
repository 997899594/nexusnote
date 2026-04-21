import type { InterviewOutline } from "@/lib/ai/interview/schemas";
import type { InterviewSessionMode } from "@/lib/ai/interview/session-mode";

export type EvalDomain = "chat" | "interview" | "learn" | "notes" | "growth";

export interface ChatEvalInput {
  message: string;
}

export interface InterviewEvalInput {
  userGoal: string;
  currentOutline?: InterviewOutline;
  mode?: InterviewSessionMode;
}

export interface LearnEvalInput {
  question: string;
  courseContext: string;
}

export interface NotesEvalInput {
  instruction: string;
  noteExcerpt: string;
}

export interface GrowthEvalNode {
  id: string;
  canonicalLabel: string;
  summary: string | null;
  progress: number;
  state: string;
  courseCount: number;
  chapterCount: number;
  evidenceScore: number;
}

export interface GrowthEvalEdge {
  from: string;
  to: string;
  confidence: number;
}

export interface GrowthEvalInput {
  graph: {
    nodes: GrowthEvalNode[];
    prerequisiteEdges: GrowthEvalEdge[];
  };
  preference: {
    selectedDirectionKey: string | null;
    preferenceVersion: number;
    selectionCount?: number;
    directionSignals?: Array<{
      directionKey: string;
      selectionCount: number;
      latestSelectedAt: string;
    }>;
  };
  previousSummary: {
    trees: Array<{
      directionKey: string;
      supportingNodeRefs: string[];
    }>;
  } | null;
  expectedMinTrees: number;
  expectedMaxTrees: number;
}

export interface EvalRegressionSpec {
  minOutputLength?: number;
  requiredSubstrings?: string[];
  forbiddenSubstrings?: string[];
  forbiddenPatterns?: string[];
}

export interface EvalCase<TInput = Record<string, unknown>> {
  id: string;
  title: string;
  domain: EvalDomain;
  promptVersion: string;
  input: TInput;
  expectations: string[];
  regression?: EvalRegressionSpec;
  tags?: string[];
}

export interface EvalSuite<TInput = Record<string, unknown>> {
  domain: EvalDomain;
  version: string;
  cases: EvalCase<TInput>[];
}

export interface EvalExecutionResult {
  caseId: string;
  title: string;
  passed: boolean;
  contract: EvalContractAssessment;
  quality: EvalQualityAssessment | null;
  output: string;
  ruleChecks?: EvalRuleCheck[];
  runtimeMetrics?: EvalRuntimeMetrics;
}

export interface EvalContractAssessment {
  score: number;
  passed: boolean;
  failedRuleNames: string[];
}

export interface EvalQualityAssessment {
  source: "ai-judge" | "deterministic";
  score: number;
  passed: boolean;
  notes: string[];
}

export interface EvalSuiteRunResult {
  domain: EvalDomain;
  version: string;
  averageContractScore: number;
  averageQualityScore: number | null;
  contractPassCount: number;
  qualityWarningCount: number;
  qualityCaseCount: number;
  totalCount: number;
  results: EvalExecutionResult[];
}

export interface EvalRuleCheck {
  name: string;
  passed: boolean;
  details: string;
}

export interface EvalRuntimeMetrics {
  totalMs: number;
  firstTextMs?: number | null;
  firstOptionsMs?: number | null;
  firstOutlineMs?: number | null;
  timedOut?: boolean;
}
