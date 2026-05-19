import { generateText, Output } from "ai";
import { buildGenerationSettingsForPolicy } from "@/lib/ai/core/generation-settings";
import { getPlainModelForPolicy } from "@/lib/ai/core/model-policy";
import { renderPromptResource } from "@/lib/ai/prompts/load-prompt";
import { performWebSearch } from "@/lib/ai/tools/chat/web-search";
import type { AIModelSeries } from "../core/model-series";
import type { ResearchWorkerProvider } from "./a2a";
import {
  type ResearchSource,
  type ResearchWorkerResult,
  type ResearchWorkerTask,
  researchWorkerSummarySchema,
} from "./contracts";

function getSourceDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

function formatSearchResults(results: ResearchSource[]) {
  if (results.length === 0) {
    return "无可用搜索结果";
  }

  return results
    .map(
      (result, index) =>
        `${index + 1}. ${result.title}\nURL: ${result.url}\n摘要: ${result.snippet || "无摘要"}`,
    )
    .join("\n\n");
}

async function runLocalResearchWorker(input: {
  userPrompt: string;
  task: ResearchWorkerTask;
  modelSeries?: AIModelSeries;
}): Promise<ResearchWorkerResult> {
  const searchOutput = await performWebSearch(input.task.query, 5);
  const sources = searchOutput.success
    ? searchOutput.results.map((result) => ({
        title: result.title,
        url: result.url,
        domain: getSourceDomain(result.url),
        snippet: result.snippet,
      }))
    : [];

  const summaryResult = await generateText({
    model: getPlainModelForPolicy("interactive-fast", {
      modelSeries: input.modelSeries,
    }),
    output: Output.object({ schema: researchWorkerSummarySchema }),
    prompt: renderPromptResource("research/worker-summary.md", {
      user_prompt: input.userPrompt,
      task_title: input.task.title,
      task_query: input.task.query,
      task_focus: input.task.focus,
      search_results: formatSearchResults(sources),
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
