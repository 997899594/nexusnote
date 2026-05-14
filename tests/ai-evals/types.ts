import type { InterviewOutline } from "@/lib/ai/interview/schemas";
import type {
  CapabilityMode,
  ConversationCapabilityMode,
  ExecutionMode,
  Surface,
} from "@/lib/ai/runtime/contracts";
import type { CareerTreeSnapshot } from "@/lib/career-tree/types";

export type EvalDomain = "chat" | "interview" | "learn" | "notes" | "routing" | "career-tree";

export interface ChatEvalInput {
  message: string;
}

export interface InterviewEvalInput {
  userGoal: string;
  messages?: Array<{
    role: "user" | "assistant";
    text: string;
  }>;
  currentOutline?: InterviewOutline;
  expectedInteraction?: "guided" | "text";
}

export interface LearnEvalInput {
  question: string;
  courseContext: string;
}

export interface NotesEvalInput {
  instruction: string;
  noteExcerpt: string;
}

export interface RoutingEvalInput {
  message: string;
  requestContext: {
    surface: Surface;
    hasLearningGuidance: boolean;
    hasCareerTreeSnapshot: boolean;
    hasEditorContext: boolean;
    courseId?: string;
    chapterIndex?: number;
    sectionIndex?: number;
    documentId?: string;
    recentMessages?: string[];
    metadataContext?: "default" | "learn" | "editor";
  };
  expectedRoute: {
    capabilityMode: CapabilityMode;
    resolvedCapabilityMode: ConversationCapabilityMode;
    executionMode: ExecutionMode;
    handoffTarget?: CapabilityMode | null;
  };
}

export interface CareerTreeEvalInput {
  snapshot: CareerTreeSnapshot;
  directionKey?: string | null;
  expected: {
    expectGraph?: boolean;
    currentCareerKey?: string;
    futureSources?: Array<"progression_role" | "candidate_tree">;
    expectedFutureCount?: number;
    requiredFutureTitles?: string[];
    forbiddenFutureTitles?: string[];
  };
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
