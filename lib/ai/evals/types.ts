export type EvalDomain = "interview" | "learn" | "notes";

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
  score: number;
  passed: boolean;
  notes: string[];
}
