import { generateText } from "ai";
import { getModelForPolicy } from "@/lib/ai/core/model-policy";
import { buildPromptInstructions } from "@/lib/ai/core/prompt-registry";
import { createTelemetryContext, recordAIUsage } from "@/lib/ai/core/telemetry";
import { judgeEvalOutput } from "./judge";
import type {
  EvalCase,
  EvalExecutionResult,
  EvalSuite,
  EvalSuiteRunResult,
  InterviewEvalInput,
  LearnEvalInput,
  NotesEvalInput,
} from "./types";

export function createEvalSuite<TInput>(suite: EvalSuite<TInput>): EvalSuite<TInput> {
  return suite;
}

function buildEvalGenerationInput(testCase: EvalCase): {
  instructions: string;
  prompt: string;
} {
  switch (testCase.domain) {
    case "interview": {
      const input = testCase.input as unknown as InterviewEvalInput;
      return {
        instructions: buildPromptInstructions("interview@v1"),
        prompt: `用户说：${input.userGoal}

请给出你现在会发给用户的下一条回复。不要解释你的思考过程，也不要输出工具调用 JSON。`,
      };
    }
    case "learn": {
      const input = testCase.input as unknown as LearnEvalInput;
      return {
        instructions: buildPromptInstructions("learn-assist@v1", {
          userContext: `## 当前课程上下文\n${input.courseContext}`,
        }),
        prompt: input.question,
      };
    }
    case "notes": {
      const input = testCase.input as unknown as NotesEvalInput;
      return {
        instructions: buildPromptInstructions("note-assist@v1", {
          userContext: `## 当前笔记内容\n${input.noteExcerpt}`,
        }),
        prompt: input.instruction,
      };
    }
    default:
      throw new Error(`Unsupported eval domain: ${testCase.domain satisfies never}`);
  }
}

function getPolicyForCase(testCase: EvalCase) {
  switch (testCase.domain) {
    case "interview":
    case "learn":
    case "notes":
      return "interactive-fast" as const;
    default:
      throw new Error(`Unsupported eval domain: ${testCase.domain satisfies never}`);
  }
}

export async function runEvalCase(testCase: EvalCase): Promise<EvalExecutionResult> {
  const startedAt = Date.now();
  const { instructions, prompt } = buildEvalGenerationInput(testCase);
  const modelPolicy = getPolicyForCase(testCase);
  const telemetry = createTelemetryContext({
    endpoint: "eval:generate",
    workflow: "ai-eval-generate",
    promptVersion: testCase.promptVersion,
    modelPolicy,
    metadata: {
      caseId: testCase.id,
      domain: testCase.domain,
    },
  });

  const generated = await generateText({
    model: getModelForPolicy(modelPolicy),
    system: instructions,
    prompt,
    temperature: 0.2,
    timeout: 30_000,
  });

  await recordAIUsage({
    ...telemetry,
    usage: generated.usage,
    durationMs: Date.now() - startedAt,
    success: true,
  });

  const judgement = await judgeEvalOutput(testCase, generated.text);

  return {
    caseId: testCase.id,
    title: testCase.title,
    score: judgement.score,
    passed: judgement.score >= 0.8,
    notes: judgement.notes,
    output: generated.text,
  };
}

export async function runEvalSuite<TInput>(suite: EvalSuite<TInput>): Promise<EvalSuiteRunResult> {
  const results: EvalExecutionResult[] = [];

  for (const testCase of suite.cases) {
    results.push(await runEvalCase(testCase as EvalCase<Record<string, unknown>>));
  }

  const totalScore = results.reduce((sum, result) => sum + result.score, 0);
  const passedCount = results.filter((result) => result.passed).length;

  return {
    domain: suite.domain,
    version: suite.version,
    averageScore: results.length > 0 ? totalScore / results.length : 0,
    passedCount,
    totalCount: results.length,
    results,
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
