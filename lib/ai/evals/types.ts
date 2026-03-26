import type { InterviewOutline } from "@/lib/ai/interview";

export type EvalDomain = "chat" | "interview" | "learn" | "notes";

export interface ChatEvalInput {
  message: string;
}

export interface InterviewEvalInput {
  userGoal: string;
  currentOutline?: InterviewOutline;
}

export interface LearnEvalInput {
  question: string;
  courseContext: string;
}

export interface NotesEvalInput {
  instruction: string;
  noteExcerpt: string;
}

export interface EvalCase<TInput = Record<string, unknown>> {
  id: string;
  title: string;
  domain: EvalDomain;
  promptVersion: string;
  input: TInput;
  expectations: string[];
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
  score: number;
  passed: boolean;
  notes: string[];
  output: string;
  ruleChecks?: EvalRuleCheck[];
  runtimeMetrics?: EvalRuntimeMetrics;
}

export interface EvalSuiteRunResult {
  domain: EvalDomain;
  version: string;
  averageScore: number;
  passedCount: number;
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
