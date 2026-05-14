import { and, asc, desc, eq, sql } from "drizzle-orm";
import {
  db,
  type ResearchRunRecord,
  researchRunSources,
  researchRuns,
  researchRunTasks,
} from "@/db";
import { buildKnowledgeContentHash } from "@/lib/knowledge/content-hash";
import type {
  BackgroundResearchMetadata,
  BackgroundResearchProgress,
  BackgroundResearchReport,
  ResearchCitation,
  ResearchRunSnapshot,
  ResearchRunStatus,
  ResearchTaskSnapshot,
  ResearchTaskStatus,
  ResearchWorkerTask,
} from "./contracts";

function toIsoString(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function buildCitationMap(params: {
  tasks: Array<{
    id: string;
    taskKey: string;
    sources: Array<{
      title: string;
      url: string;
      domain: string;
      snippet: string;
    }>;
  }>;
}): ResearchCitation[] {
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

  for (const task of params.tasks) {
    for (const source of task.sources) {
      const existing = byUrl.get(source.url);
      if (existing) {
        if (!existing.taskKeys.includes(task.taskKey)) {
          existing.taskKeys.push(task.taskKey);
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
        taskKeys: [task.taskKey],
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

async function loadResearchRunTasks(runId: string): Promise<ResearchTaskSnapshot[]> {
  const tasks = await db
    .select()
    .from(researchRunTasks)
    .where(eq(researchRunTasks.runId, runId))
    .orderBy(asc(researchRunTasks.ordinal));

  if (tasks.length === 0) {
    return [];
  }

  const sourceRows = await db
    .select()
    .from(researchRunSources)
    .where(eq(researchRunSources.runId, runId))
    .orderBy(asc(researchRunSources.rank), asc(researchRunSources.createdAt));

  const sourcesByTaskId = new Map<string, typeof sourceRows>();
  for (const source of sourceRows) {
    if (!source.taskId) {
      continue;
    }

    const current = sourcesByTaskId.get(source.taskId) ?? [];
    current.push(source);
    sourcesByTaskId.set(source.taskId, current);
  }

  return tasks.map((task) => ({
    id: task.id,
    taskKey: task.taskKey,
    title: task.title,
    query: task.query,
    focus: task.focus,
    ordinal: task.ordinal,
    status: task.status as ResearchTaskStatus,
    summary: task.summary ?? null,
    findings: task.findings,
    evidenceGaps: task.evidenceGaps,
    errorMessage: task.errorMessage ?? null,
    startedAt: toIsoString(task.startedAt),
    finishedAt: toIsoString(task.finishedAt),
    sources: (sourcesByTaskId.get(task.id) ?? []).map((source) => ({
      title: source.title,
      url: source.url,
      domain: source.domain,
      snippet: source.snippet,
    })),
  }));
}

function buildRunMetadata(run: ResearchRunSnapshot): BackgroundResearchMetadata {
  return {
    runId: run.id,
    type: run.jobType,
    state: run.status,
    enqueuedAt: run.createdAt,
    startedAt: run.startedAt ?? undefined,
    completedAt: run.finishedAt ?? undefined,
    failedReason: run.errorMessage ?? undefined,
  };
}

export function createResearchInputHash(params: {
  userPrompt: string;
  routeProfile?: string | null;
  sessionId?: string | null;
}): string {
  return buildKnowledgeContentHash(
    JSON.stringify({
      prompt: params.userPrompt.trim(),
      routeProfile: params.routeProfile ?? null,
      sessionId: params.sessionId ?? null,
    }),
  );
}

export async function createResearchRun(params: {
  userId: string;
  sessionId?: string | null;
  userPrompt: string;
  routeProfile?: string | null;
  retryOfRunId?: string | null;
}): Promise<ResearchRunRecord> {
  const [created] = await db
    .insert(researchRuns)
    .values({
      userId: params.userId,
      sessionId: params.sessionId ?? null,
      jobType: "run_background_research",
      status: "queued",
      routeProfile: params.routeProfile ?? null,
      workerTransport: "local",
      userPrompt: params.userPrompt.trim(),
      inputHash: createResearchInputHash({
        userPrompt: params.userPrompt,
        routeProfile: params.routeProfile,
        sessionId: params.sessionId,
      }),
      retryOfRunId: params.retryOfRunId ?? null,
      progressJson: {
        stage: "queued",
        message: "研究任务已入队，等待后台 worker 处理。",
        updatedAt: new Date().toISOString(),
      },
    })
    .returning();

  if (!created) {
    throw new Error("Failed to create research run.");
  }

  return created;
}

export async function markResearchRunQueued(runId: string) {
  await db
    .update(researchRuns)
    .set({
      queueJobId: runId,
      updatedAt: new Date(),
    })
    .where(eq(researchRuns.id, runId));
}

export async function setResearchRunProgress(
  runId: string,
  status: ResearchRunStatus,
  progress: BackgroundResearchProgress,
) {
  await db
    .update(researchRuns)
    .set({
      status,
      progressJson: progress,
      updatedAt: new Date(),
      ...(status === "running" && { startedAt: sql`coalesce(${researchRuns.startedAt}, now())` }),
      ...(status === "cancel_requested" && { cancelRequestedAt: new Date() }),
    })
    .where(eq(researchRuns.id, runId));
}

export async function saveResearchPlan(params: {
  runId: string;
  plan: {
    reportTitle: string;
    summaryGoal: string;
    tasks: ResearchWorkerTask[];
  };
}) {
  await db.transaction(async (tx) => {
    await tx
      .update(researchRuns)
      .set({
        planJson: params.plan,
        updatedAt: new Date(),
      })
      .where(eq(researchRuns.id, params.runId));

    await tx.delete(researchRunTasks).where(eq(researchRunTasks.runId, params.runId));

    if (params.plan.tasks.length === 0) {
      return;
    }

    await tx.insert(researchRunTasks).values(
      params.plan.tasks.map((task, index) => ({
        runId: params.runId,
        taskKey: task.id,
        ordinal: index,
        title: task.title,
        query: task.query,
        focus: task.focus,
        status: "queued",
      })),
    );
  });
}

export async function getResearchRunById(runId: string) {
  const [run] = await db.select().from(researchRuns).where(eq(researchRuns.id, runId)).limit(1);
  return run ?? null;
}

export async function updateResearchTaskStatus(params: {
  runId: string;
  taskKey: string;
  status: ResearchTaskStatus;
  summary?: string | null;
  findings?: string[];
  evidenceGaps?: string[];
  errorMessage?: string | null;
  sources?: Array<{
    title: string;
    url: string;
    domain: string;
    snippet: string;
  }>;
}) {
  await db.transaction(async (tx) => {
    const [task] = await tx
      .select()
      .from(researchRunTasks)
      .where(
        and(eq(researchRunTasks.runId, params.runId), eq(researchRunTasks.taskKey, params.taskKey)),
      )
      .limit(1);

    if (!task) {
      throw new Error(`Missing research task ${params.taskKey} for run ${params.runId}`);
    }

    await tx
      .update(researchRunTasks)
      .set({
        status: params.status,
        ...(params.summary !== undefined && { summary: params.summary }),
        ...(params.findings !== undefined && { findings: params.findings }),
        ...(params.evidenceGaps !== undefined && { evidenceGaps: params.evidenceGaps }),
        ...(params.errorMessage !== undefined && { errorMessage: params.errorMessage }),
        ...(params.status === "running" && { startedAt: new Date() }),
        ...(params.status === "completed" ||
        params.status === "failed" ||
        params.status === "canceled"
          ? { finishedAt: new Date() }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(researchRunTasks.id, task.id));

    if (params.sources) {
      await tx.delete(researchRunSources).where(eq(researchRunSources.taskId, task.id));

      if (params.sources.length > 0) {
        await tx.insert(researchRunSources).values(
          params.sources.map((source, index) => ({
            runId: params.runId,
            taskId: task.id,
            title: source.title,
            url: source.url,
            domain: source.domain,
            snippet: source.snippet,
            rank: index,
          })),
        );
      }
    }
  });
}

export async function completeResearchRun(params: {
  runId: string;
  report: BackgroundResearchReport;
}) {
  await db
    .update(researchRuns)
    .set({
      status: "completed",
      reportJson: params.report as unknown as Record<string, unknown>,
      progressJson: {
        stage: "completed",
        message: "研究任务已完成。",
        updatedAt: new Date().toISOString(),
      },
      errorCode: null,
      errorMessage: null,
      finishedAt: new Date(),
      updatedAt: new Date(),
      cancelRequestedAt: null,
    })
    .where(eq(researchRuns.id, params.runId));
}

export async function failResearchRun(params: {
  runId: string;
  errorCode: string;
  errorMessage: string;
  status?: Extract<ResearchRunStatus, "failed" | "canceled">;
}) {
  const status = params.status ?? "failed";
  await db
    .update(researchRuns)
    .set({
      status,
      errorCode: params.errorCode,
      errorMessage: params.errorMessage,
      progressJson: {
        stage: status,
        message: params.errorMessage,
        updatedAt: new Date().toISOString(),
      },
      finishedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(researchRuns.id, params.runId));
}

export async function requestResearchRunCancellation(runId: string) {
  await db
    .update(researchRuns)
    .set({
      status: "cancel_requested",
      cancelRequestedAt: new Date(),
      progressJson: {
        stage: "cancel_requested",
        message: "已请求取消，当前任务会在安全边界停止。",
        updatedAt: new Date().toISOString(),
      },
      updatedAt: new Date(),
    })
    .where(eq(researchRuns.id, runId));
}

export async function getResearchRunSnapshot(
  runId: string,
  userId: string,
): Promise<ResearchRunSnapshot | null> {
  const [run] = await db
    .select()
    .from(researchRuns)
    .where(and(eq(researchRuns.id, runId), eq(researchRuns.userId, userId)))
    .limit(1);

  if (!run) {
    return null;
  }

  const tasks = await loadResearchRunTasks(run.id);
  const citations =
    (run.reportJson as BackgroundResearchReport | null)?.citations ??
    buildCitationMap({
      tasks: tasks.map((task) => ({
        id: task.id,
        taskKey: task.taskKey,
        sources: task.sources,
      })),
    });

  const report = run.reportJson as BackgroundResearchReport | null;

  return {
    id: run.id,
    jobType: run.jobType as "run_background_research",
    status: run.status as ResearchRunStatus,
    userPrompt: run.userPrompt,
    routeProfile: run.routeProfile,
    workerTransport: run.workerTransport,
    progress: (run.progressJson as BackgroundResearchProgress | null) ?? null,
    report: report
      ? {
          ...report,
          citations,
        }
      : null,
    tasks,
    citations,
    errorCode: run.errorCode ?? null,
    errorMessage: run.errorMessage ?? null,
    cancelRequestedAt: toIsoString(run.cancelRequestedAt),
    startedAt: toIsoString(run.startedAt),
    finishedAt: toIsoString(run.finishedAt),
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
    canCancel:
      run.status === "queued" || run.status === "running" || run.status === "cancel_requested",
    canRetry: run.status === "failed" || run.status === "canceled",
  };
}

export async function getLatestSessionResearchRunMetadata(
  sessionId: string,
  userId: string,
): Promise<BackgroundResearchMetadata | null> {
  const [run] = await db
    .select()
    .from(researchRuns)
    .where(and(eq(researchRuns.sessionId, sessionId), eq(researchRuns.userId, userId)))
    .orderBy(desc(researchRuns.createdAt))
    .limit(1);

  if (!run) {
    return null;
  }

  const snapshot = await getResearchRunSnapshot(run.id, userId);
  return snapshot ? buildRunMetadata(snapshot) : null;
}

export async function buildResearchRunMetadata(
  runId: string,
  userId: string,
): Promise<BackgroundResearchMetadata | null> {
  const snapshot = await getResearchRunSnapshot(runId, userId);
  return snapshot ? buildRunMetadata(snapshot) : null;
}
