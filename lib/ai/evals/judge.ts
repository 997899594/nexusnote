import { generateObject } from "ai";
import { z } from "zod";
import { getJsonModelForPolicy } from "@/lib/ai/core";
import { createTelemetryContext, recordAIUsage } from "@/lib/ai/core/telemetry";
import type { EvalCase } from "./types";

const EvalJudgementSchema = z.object({
  score: z.number().min(0).max(1),
  notes: z.array(z.string()).min(1).max(5),
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
    modelPolicy: "structured-high-quality",
    metadata: {
      caseId: testCase.id,
      domain: testCase.domain,
    },
  });

  const result = await generateObject({
    model: getJsonModelForPolicy("structured-high-quality"),
    schema: EvalJudgementSchema,
    timeout: 30_000,
    system: `你是一个严格但公平的 AI 质量评估员。

请根据给定测试用例的 expectations，对 assistant 输出进行评分。

评分标准：
- 1.0 = 完全满足 expectations，几乎可以直接上线
- 0.8 = 基本满足 expectations，只有轻微不足
- 0.6 = 部分满足 expectations，但存在明显缺口
- 0.4 = 只命中少部分 expectations
- 0.2 = 基本不符合 expectations
- 0.0 = 完全失败

只看 expectations，不要因为文风华丽而加分。
notes 里只写关键判断，不要写空话。`,
    prompt: `测试用例：
${JSON.stringify(testCase, null, 2)}

Assistant 输出：
${output}`,
    temperature: 0,
  });

  await recordAIUsage({
    ...telemetry,
    usage: result.usage,
    durationMs: Date.now() - startedAt,
    success: true,
  });

  return result.object;
}
