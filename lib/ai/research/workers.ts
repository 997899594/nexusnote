import { buildGenerationSettingsForPolicy } from "@/lib/ai/core/generation-settings";
import { getPlainModelForPolicy } from "@/lib/ai/core/model-policy";
import { generateStructuredObject } from "@/lib/ai/core/structured-output";
import { renderPromptResource } from "@/lib/ai/prompts/load-prompt";
import type { AIModelSeries } from "../core/model-series";
import type { ResearchWorkerProvider } from "./a2a";
import {
  type ResearchWorkerResult,
  type ResearchWorkerTask,
  researchWorkerSummarySchema,
} from "./contracts";
import { collectResearchEvidence, formatResearchEvidenceForPrompt } from "./web-research";

async function runLocalResearchWorker(input: {
  userPrompt: string;
  task: ResearchWorkerTask;
  modelSeries?: AIModelSeries;
}): Promise<ResearchWorkerResult> {
  const retrieval = await collectResearchEvidence({
    query: input.task.query,
    focus: input.task.focus,
    limit: 6,
    maxExtractedSources: 8,
  });
  const sources = retrieval.sources;

  const summaryResult = await generateStructuredObject({
    model: getPlainModelForPolicy("interactive-fast", {
      modelSeries: input.modelSeries,
    }),
    schema: researchWorkerSummarySchema,
    prompt: renderPromptResource("research/worker-summary.md", {
      user_prompt: input.userPrompt,
      task_title: input.task.title,
      task_query: input.task.query,
      task_focus: input.task.focus,
      search_results: formatResearchEvidenceForPrompt(sources),
    }),
    ...buildGenerationSettingsForPolicy(
      "interactive-fast",
      {
        temperature: 0.1,
        maxOutputTokens: 700,
      },
      { modelSeries: input.modelSeries },
    ),
    timeout: 20_000,
  });

  return {
    task: input.task,
    summary: summaryResult.output.summary,
    findings: summaryResult.output.findings,
    evidenceGaps: summaryResult.output.evidenceGaps,
    sources,
  };
}

function createLocalResearchWorkerProvider(options?: {
  modelSeries?: AIModelSeries;
}): ResearchWorkerProvider {
  return {
    kind: "local",
    async runTask(input) {
      return runLocalResearchWorker({
        userPrompt: input.userPrompt,
        task: input.task,
        modelSeries: options?.modelSeries,
      });
    },
  };
}

function createRemoteA2AResearchWorkerProvider(): ResearchWorkerProvider {
  return {
    kind: "remote_a2a",
    async runTask() {
      throw new Error("A2A research workers are not configured yet.");
    },
  };
}

export function resolveResearchWorkerProvider(options?: {
  modelSeries?: AIModelSeries;
  preferRemoteA2A?: boolean;
}): ResearchWorkerProvider {
  if (options?.preferRemoteA2A) {
    return createRemoteA2AResearchWorkerProvider();
  }

  return createLocalResearchWorkerProvider({
    modelSeries: options?.modelSeries,
  });
}
