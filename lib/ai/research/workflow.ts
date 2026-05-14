import type { UIMessage } from "ai";
import { generateText, Output } from "ai";
import { buildGenerationSettingsForPolicy } from "@/lib/ai/core/generation-settings";
import { getPlainModelForPolicy } from "@/lib/ai/core/model-policy";
import { renderPromptResource } from "@/lib/ai/prompts/load-prompt";
import { syncConversationKnowledge } from "@/lib/chat/conversation-knowledge";
import { loadConversationMessages } from "@/lib/chat/conversation-messages";
import { persistConversationMessages } from "@/lib/chat/conversation-persistence";
import { getOwnedConversation } from "@/lib/chat/conversation-repository";
import { isUuidString } from "@/lib/chat/session-id";
import type { AIRouteProfile } from "../core/route-profiles";
import {
  type BackgroundResearchProgress,
  type BackgroundResearchReport,
  type ResearchCitation,
  type ResearchWorkerResult,
  researchPlanSchema,
} from "./contracts";
import {
  completeResearchRun,
  getResearchRunById,
  saveResearchPlan,
  setResearchRunProgress,
  updateResearchTaskStatus,
} from "./store";
import { resolveResearchWorkerProvider } from "./workers";

function buildProgress(
  stage: BackgroundResearchProgress["stage"],
  message: string,
  extras?: Partial<BackgroundResearchProgress>,
): BackgroundResearchProgress {
  return {
    stage,
    message,
    updatedAt: new Date().toISOString(),
    ...extras,
  };
}

function buildCanonicalCitations(workerResults: ResearchWorkerResult[]): ResearchCitation[] {
  const byUrl = new Map<
    string,
    {
      title: string;
      url: string;
      domain: string;
      snippets: string[];
      taskKeys: string[];
    }
  >();

  for (const result of workerResults) {
    for (const source of result.sources) {
      const existing = byUrl.get(source.url);
      if (existing) {
        if (!existing.taskKeys.includes(result.task.id)) {
          existing.taskKeys.push(result.task.id);
        }
        if (source.snippet && !existing.snippets.includes(source.snippet)) {
          existing.snippets.push(source.snippet);
        }
        continue;
      }

      byUrl.set(source.url, {
        title: source.title,
        url: source.url,
        domain: source.domain,
        snippets: source.snippet ? [source.snippet] : [],
        taskKeys: [result.task.id],
      });
    }
  }

  return [...byUrl.values()].map((source, index) => ({
    id: `S${index + 1}`,
    title: source.title,
    url: source.url,
    domain: source.domain,
    snippets: source.snippets.slice(0, 2),
    taskKeys: [...source.taskKeys].sort(),
  }));
}

function createCitationLookup(citations: ResearchCitation[]) {
  return new Map(citations.map((citation) => [citation.url, citation.id]));
}

function buildWorkerResultsBlock(
  workerResults: ResearchWorkerResult[],
  citationLookup: Map<string, string>,
) {
  return workerResults
    .map((result, index) => {
      const sources = result.sources
        .map((source, sourceIndex) => `${sourceIndex + 1}. ${source.title} - ${source.url}`)
        .map((line, lineIndex) => {
          const source = result.sources[lineIndex];
          const citationId = citationLookup.get(source.url);
          return citationId ? `[${citationId}] ${line}` : line;
        })
        .join("\n");

      return [
        `### Worker ${index + 1}: ${result.task.title}`,
        `查询：${result.task.query}`,
        `聚焦：${result.task.focus}`,
        `总结：${result.summary}`,
        "发现：",
        ...result.findings.map((finding) => `- ${finding}`),
        ...(result.evidenceGaps.length > 0
          ? ["证据缺口：", ...result.evidenceGaps.map((gap) => `- ${gap}`)]
          : []),
        sources ? `来源：\n${sources}` : "来源：无",
      ].join("\n");
    })
    .join("\n\n");
}

function buildCitationCatalog(citations: ResearchCitation[]) {
  if (citations.length === 0) {
    return "无";
  }

  return citations
    .map(
      (citation) =>
        `[${citation.id}] ${citation.title}\nURL: ${citation.url}\n域名: ${citation.domain}\n关联任务: ${citation.taskKeys.join(", ")}`,
    )
    .join("\n\n");
}

function stripSourcesSection(markdown: string) {
  return markdown.replace(/\n## 来源[\s\S]*$/u, "").trim();
}

function appendStructuredSources(markdown: string, citations: ResearchCitation[]) {
  const body = stripSourcesSection(markdown);
  if (citations.length === 0) {
    return body;
  }

  const sourcesBlock = citations
    .map((citation) => `- [${citation.id}] [${citation.title}](${citation.url})`)
    .join("\n");

  return `${body}\n\n## 来源\n${sourcesBlock}`;
}

function buildAssistantResearchResultMessage(report: BackgroundResearchReport): UIMessage {
  return {
    id: crypto.randomUUID(),
    role: "assistant",
    parts: [{ type: "text", text: report.reportMarkdown }],
  };
}

async function persistResearchResultToConversation(params: {
  conversationId: string;
  userId: string;
  report: BackgroundResearchReport;
}) {
  if (!isUuidString(params.conversationId)) {
    return false;
  }

  const conversation = await getOwnedConversation(params.conversationId, params.userId);
  if (!conversation) {
    return false;
  }

  const existingMessages = await loadConversationMessages(params.conversationId);
  const nextMessages = [...existingMessages, buildAssistantResearchResultMessage(params.report)];
  await persistConversationMessages(params.conversationId, params.userId, nextMessages);
  await syncConversationKnowledge({
    conversationId: params.conversationId,
    userId: params.userId,
    messages: nextMessages,
  });
  return true;
}

export class ResearchRunCancelledError extends Error {
  constructor(message = "研究任务已取消") {
    super(message);
    this.name = "ResearchRunCancelledError";
  }
}

async function assertResearchRunStillActive(runId: string) {
  const run = await getResearchRunById(runId);

  if (!run) {
    throw new Error(`Missing research run ${runId}`);
  }

  if (run.status === "cancel_requested" || run.cancelRequestedAt) {
    throw new ResearchRunCancelledError();
  }

  if (run.status === "canceled") {
    throw new ResearchRunCancelledError();
  }
}

export async function runBackgroundResearchWorkflow(params: {
  runId: string;
  userId: string;
  userPrompt: string;
  sessionId?: string | null;
  routeProfile?: AIRouteProfile;
}): Promise<
  BackgroundResearchReport & {
    persistedToConversation: boolean;
  }
> {
  await setResearchRunProgress(
    params.runId,
    "running",
    buildProgress("planning", "正在拆分研究任务。"),
  );
  await assertResearchRunStillActive(params.runId);

  const managerResult = await generateText({
    model: getPlainModelForPolicy("interactive-fast", {
      routeProfile: params.routeProfile,
    }),
    output: Output.object({ schema: researchPlanSchema }),
    prompt: renderPromptResource("research/manager-plan.md", {
      user_prompt: params.userPrompt,
    }),
    ...buildGenerationSettingsForPolicy(
      "interactive-fast",
      {
        temperature: 0.1,
        maxOutputTokens: 700,
      },
      { routeProfile: params.routeProfile },
    ),
    timeout: 20_000,
  });

  await saveResearchPlan({
    runId: params.runId,
    plan: {
      reportTitle: managerResult.output.reportTitle,
      summaryGoal: managerResult.output.summaryGoal,
      tasks: managerResult.output.tasks,
    },
  });

  await setResearchRunProgress(
    params.runId,
    "running",
    buildProgress(
      "researching",
      `已拆分为 ${managerResult.output.tasks.length} 个并行研究子任务。`,
      {
        totalTasks: managerResult.output.tasks.length,
        completedTasks: 0,
      },
    ),
  );

  const workerProvider = resolveResearchWorkerProvider({
    routeProfile: params.routeProfile,
  });
  let completedTasks = 0;
  const taskResults = await Promise.allSettled(
    managerResult.output.tasks.map(async (task) => {
      await assertResearchRunStillActive(params.runId);
      await updateResearchTaskStatus({
        runId: params.runId,
        taskKey: task.id,
        status: "running",
      });

      try {
        const result = await workerProvider.runTask({
          userPrompt: params.userPrompt,
          task,
        });

        await updateResearchTaskStatus({
          runId: params.runId,
          taskKey: task.id,
          status: "completed",
          summary: result.summary,
          findings: result.findings,
          evidenceGaps: result.evidenceGaps,
          sources: result.sources,
        });

        completedTasks += 1;
        await setResearchRunProgress(
          params.runId,
          "running",
          buildProgress(
            "researching",
            `已完成 ${completedTasks}/${managerResult.output.tasks.length} 个研究子任务。`,
            {
              totalTasks: managerResult.output.tasks.length,
              completedTasks,
              activeTaskKey: task.id,
            },
          ),
        );

        return result;
      } catch (error) {
        await updateResearchTaskStatus({
          runId: params.runId,
          taskKey: task.id,
          status: error instanceof ResearchRunCancelledError ? "canceled" : "failed",
          errorMessage: error instanceof Error ? error.message : "研究子任务执行失败",
        });
        throw error;
      }
    }),
  );

  const firstRejected = taskResults.find(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );

  if (firstRejected) {
    throw firstRejected.reason;
  }

  const workerResults = taskResults.map(
    (result) => (result as PromiseFulfilledResult<ResearchWorkerResult>).value,
  );
  const citations = buildCanonicalCitations(workerResults);
  const citationLookup = createCitationLookup(citations);

  await assertResearchRunStillActive(params.runId);
  await setResearchRunProgress(
    params.runId,
    "running",
    buildProgress("synthesizing", "正在综合子任务发现并生成最终报告。", {
      totalTasks: managerResult.output.tasks.length,
      completedTasks: managerResult.output.tasks.length,
    }),
  );

  const synthesisResult = await generateText({
    model: getPlainModelForPolicy("quality-review", {
      routeProfile: params.routeProfile,
    }),
    prompt: renderPromptResource("research/synthesis.md", {
      user_prompt: params.userPrompt,
      report_title: managerResult.output.reportTitle,
      summary_goal: managerResult.output.summaryGoal,
      worker_results: buildWorkerResultsBlock(workerResults, citationLookup),
      citation_catalog: buildCitationCatalog(citations),
    }),
    ...buildGenerationSettingsForPolicy(
      "quality-review",
      {
        temperature: 0.15,
        maxOutputTokens: 1800,
      },
      { routeProfile: params.routeProfile },
    ),
    timeout: 35_000,
  });

  await assertResearchRunStillActive(params.runId);
  await setResearchRunProgress(
    params.runId,
    "running",
    buildProgress("persisting", "正在写回研究结果并同步会话知识。", {
      totalTasks: managerResult.output.tasks.length,
      completedTasks: managerResult.output.tasks.length,
    }),
  );

  const report: BackgroundResearchReport = {
    reportTitle: managerResult.output.reportTitle,
    reportMarkdown: appendStructuredSources(synthesisResult.text.trim(), citations),
    sourceCount: citations.length,
    completedAt: new Date().toISOString(),
    citations,
  };

  const persistedToConversation =
    params.sessionId != null
      ? await persistResearchResultToConversation({
          conversationId: params.sessionId,
          userId: params.userId,
          report,
        })
      : false;

  await completeResearchRun({
    runId: params.runId,
    report,
  });

  return {
    ...report,
    persistedToConversation,
  };
}
