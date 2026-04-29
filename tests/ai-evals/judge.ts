import { generateText, Output } from "ai";
import { z } from "zod";
import { buildGenerationSettingsForPolicy } from "@/lib/ai/core/generation-settings";
import { getPlainModelForPolicy } from "@/lib/ai/core/model-policy";
import { createTelemetryContext, recordAIUsage } from "@/lib/ai/core/telemetry";
import { loadPromptResource, renderPromptResource } from "@/lib/ai/prompts/load-prompt";
import type { EvalCase } from "./types";

const EvalJudgementSchema = z.object({
  score: z.number().min(0).max(1),
  notes: z.array(z.string()).min(1).max(5),
});

const EVAL_RECORD_USAGE = false;
const EVAL_JUDGE_SYSTEM_PROMPT = loadPromptResource("eval-judge-system.md");
const buildEvalJudgeUserPrompt = (testCase: EvalCase, output: string) =>
  renderPromptResource("eval-judge-user.md", {
    test_case: JSON.stringify(testCase, null, 2),
    assistant_output: output,
  });

export interface EvalJudgement {
  score: number;
  notes: string[];
}

export async function judgeEvalOutput(testCase: EvalCase, output: string): Promise<EvalJudgement> {
  const startedAt = Date.now();
  const telemetry = createTelemetryContext({
    endpoint: "eval:judge",
    workflow: "ai-eval-judge",
    promptVersion: "eval-judge@v1",
    modelPolicy: "quality-review",
    metadata: {
      caseId: testCase.id,
      domain: testCase.domain,
    },
  });

  const result = await generateText({
    model: getPlainModelForPolicy("quality-review"),
    output: Output.object({ schema: EvalJudgementSchema }),
    timeout: 30_000,
    system: EVAL_JUDGE_SYSTEM_PROMPT,
    prompt: buildEvalJudgeUserPrompt(testCase, output),
    ...buildGenerationSettingsForPolicy("quality-review", {
      temperature: 0,
    }),
  });

  if (EVAL_RECORD_USAGE) {
    await recordAIUsage({
      ...telemetry,
      usage: result.usage,
      durationMs: Date.now() - startedAt,
      success: true,
    });
  }

  return result.output;
}
