import type { EvalCase, EvalExecutionResult, EvalSuite } from "./types";

export function createEvalSuite<TInput>(suite: EvalSuite<TInput>): EvalSuite<TInput> {
  return suite;
}

export function createEvalResult(
  testCase: EvalCase,
  score: number,
  notes: string[] = [],
): EvalExecutionResult {
  return {
    caseId: testCase.id,
    score,
    passed: score >= 0.8,
    notes,
  };
}

export function summarizeEvalSuite<TInput>(suite: EvalSuite<TInput>) {
  return {
    domain: suite.domain,
    version: suite.version,
    caseCount: suite.cases.length,
    caseIds: suite.cases.map((testCase) => testCase.id),
  };
}
