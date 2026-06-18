import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { careerGenerationRuns, careerUserTreeSnapshots, db } from "@/db";
import {
  CAREER_TREE_COMPOSE_PROMPT_VERSION,
  CAREER_TREE_EXTRACT_PROMPT_VERSION,
  CAREER_TREE_MERGE_PROMPT_VERSION,
  CAREER_TREE_SCHEMA_VERSION,
} from "@/lib/career-tree/constants";
import {
  getCareerTreeRunModelName,
  isCurrentCareerTreeRun,
} from "@/lib/career-tree/model-candidates";
import {
  type CareerTreePipelineStage,
  getCareerTreeStageForJobType,
} from "@/lib/career-tree/pipeline-log";
import { getErrorMessage, writeStructuredLog } from "@/lib/observability/structured-log";
import { type CareerTreeJobData, getCareerTreeQueue } from "@/lib/queue/career-tree-queue";

type CareerRunKind = "extract" | "merge" | "compose";
type CareerPipelineState = "idle" | "queued" | "running" | "ready" | "failed" | "stalled";
type CareerPipelineQueueState = "waiting" | "active" | "delayed" | "prioritized" | "unknown";

export interface CareerTreePipelineRunSummary {
  runId: string;
  stage: CareerRunKind;
  status: string;
  courseId: string | null;
  model: string;
  promptVersion: string;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  errorMessage: string | null;
}

export interface CareerTreePipelineQueueSummary {
  jobId: string | null;
  name: string;
  type: string;
  state: CareerPipelineQueueState;
  stage: CareerTreePipelineStage;
  courseId: string | null;
  requestKey: string | null;
  queuedAt: string | null;
  processedAt: string | null;
  attemptsMade: number;
}

export interface CareerTreePipelineStatus {
  state: CareerPipelineState;
  stage: CareerTreePipelineStage | null;
  message: string;
  hasReadySnapshot: boolean;
  generatedAt: string | null;
  lastActivityAt: string | null;
  staleAfterMs: number;
  queue: {
    waiting: number;
    active: number;
    delayed: number;
    prioritized: number;
    jobs: CareerTreePipelineQueueSummary[];
  };
  runs: {
    latest: CareerTreePipelineRunSummary | null;
    running: CareerTreePipelineRunSummary[];
    failed: CareerTreePipelineRunSummary | null;
  };
}

const CAREER_TREE_PIPELINE_STALE_AFTER_MS = 10 * 60 * 1000;
const RECENT_RUN_LIMIT = 12;
const QUEUE_SCAN_LIMIT = 100;
const QUEUE_STATES = ["waiting", "active", "delayed", "prioritized"] as const;
const runStageRank: Record<CareerRunKind, number> = {
  extract: 1,
  merge: 2,
  compose: 3,
};

const promptVersionByRunKind = {
  extract: CAREER_TREE_EXTRACT_PROMPT_VERSION,
  merge: CAREER_TREE_MERGE_PROMPT_VERSION,
  compose: CAREER_TREE_COMPOSE_PROMPT_VERSION,
} satisfies Record<CareerRunKind, string>;

function toIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function getRunActivityDate(run: typeof careerGenerationRuns.$inferSelect): Date {
  return run.finishedAt ?? run.startedAt ?? run.createdAt;
}

function readJobCourseId(data: unknown): string | null {
  if (typeof data !== "object" || data === null || !("courseId" in data)) {
    return null;
  }

  const courseId = (data as { courseId?: unknown }).courseId;
  return typeof courseId === "string" ? courseId : null;
}

function readJobRequestKey(data: unknown): string | null {
  if (typeof data !== "object" || data === null || !("requestKey" in data)) {
    return null;
  }

  const requestKey = (data as { requestKey?: unknown }).requestKey;
  return typeof requestKey === "string" ? requestKey : null;
}

function isCareerTreeJobForUser(data: unknown, userId: string): data is CareerTreeJobData {
  if (typeof data !== "object" || data === null || !("type" in data) || !("userId" in data)) {
    return false;
  }

  const typedData = data as { type?: unknown; userId?: unknown };
  return (
    typedData.userId === userId &&
    (typedData.type === "refresh_user_career_tree_snapshot" ||
      typedData.type === "extract_course_evidence" ||
      typedData.type === "merge_user_skill_graph" ||
      typedData.type === "compose_user_career_trees")
  );
}

function normalizeQueueState(state: string): CareerPipelineQueueState {
  if (state === "waiting" || state === "active" || state === "delayed" || state === "prioritized") {
    return state;
  }

  return "unknown";
}

function isCurrentCareerRun(run: typeof careerGenerationRuns.$inferSelect): boolean {
  const kind = run.kind as CareerRunKind;
  return (
    promptVersionByRunKind[kind] === run.promptVersion &&
    isCurrentCareerTreeRun({
      kind: run.kind,
      model: run.model,
      promptVersion: run.promptVersion,
    })
  );
}

function summarizeRun(run: typeof careerGenerationRuns.$inferSelect): CareerTreePipelineRunSummary {
  return {
    runId: run.id,
    stage: run.kind as CareerRunKind,
    status: run.status,
    courseId: run.courseId,
    model: run.model,
    promptVersion: run.promptVersion,
    startedAt: toIso(run.startedAt),
    finishedAt: toIso(run.finishedAt),
    createdAt: run.createdAt.toISOString(),
    errorMessage: run.errorMessage,
  };
}

function formatPipelineMessage(params: {
  state: CareerPipelineState;
  stage: CareerTreePipelineStage | null;
  activeCount: number;
  queuedCount: number;
  failedRun: CareerTreePipelineRunSummary | null;
}): string {
  if (params.state === "ready") {
    return "职业树已生成。";
  }

  if (params.state === "failed" && params.failedRun) {
    return `${params.failedRun.stage} 阶段失败：${params.failedRun.errorMessage ?? "未知错误"}`;
  }

  if (params.state === "stalled") {
    return "职业树生成长时间没有进展，请重新触发生成。";
  }

  if (params.state === "running") {
    return `正在执行 ${params.stage ?? "职业树"} 阶段。`;
  }

  if (params.state === "queued") {
    return `职业树生成已排队，待处理 ${params.queuedCount} 个任务。`;
  }

  return "职业树还没有开始生成。";
}

async function getCurrentReadySnapshotSummary(userId: string) {
  return db
    .select({
      generatedAt: careerUserTreeSnapshots.generatedAt,
      createdAt: careerUserTreeSnapshots.createdAt,
    })
    .from(careerUserTreeSnapshots)
    .innerJoin(
      careerGenerationRuns,
      eq(careerUserTreeSnapshots.composeRunId, careerGenerationRuns.id),
    )
    .where(
      and(
        eq(careerUserTreeSnapshots.userId, userId),
        eq(careerUserTreeSnapshots.schemaVersion, CAREER_TREE_SCHEMA_VERSION),
        eq(careerUserTreeSnapshots.status, "ready"),
        eq(careerGenerationRuns.status, "succeeded"),
        eq(careerGenerationRuns.model, getCareerTreeRunModelName("compose")),
        eq(careerGenerationRuns.promptVersion, CAREER_TREE_COMPOSE_PROMPT_VERSION),
      ),
    )
    .orderBy(desc(careerUserTreeSnapshots.createdAt))
    .limit(1);
}

async function listCurrentCareerRuns(userId: string) {
  return db
    .select()
    .from(careerGenerationRuns)
    .where(
      and(
        eq(careerGenerationRuns.userId, userId),
        inArray(careerGenerationRuns.kind, ["extract", "merge", "compose"]),
        inArray(careerGenerationRuns.promptVersion, [
          CAREER_TREE_EXTRACT_PROMPT_VERSION,
          CAREER_TREE_MERGE_PROMPT_VERSION,
          CAREER_TREE_COMPOSE_PROMPT_VERSION,
        ]),
      ),
    )
    .orderBy(
      desc(
        sql`coalesce(${careerGenerationRuns.finishedAt}, ${careerGenerationRuns.startedAt}, ${careerGenerationRuns.createdAt})`,
      ),
    )
    .limit(RECENT_RUN_LIMIT);
}

async function listUserCareerTreeQueueJobs(
  userId: string,
): Promise<CareerTreePipelineQueueSummary[]> {
  let jobs: Awaited<ReturnType<ReturnType<typeof getCareerTreeQueue>["getJobs"]>>;
  try {
    const queue = getCareerTreeQueue();
    jobs = await queue.getJobs([...QUEUE_STATES], 0, QUEUE_SCAN_LIMIT - 1, false);
  } catch (error) {
    writeStructuredLog("warn", "career_tree_pipeline_queue_status_unavailable", {
      workflow: "career-tree",
      userId,
      errorMessage: getErrorMessage(error),
    });
    return [];
  }

  return jobs
    .filter((job) => isCareerTreeJobForUser(job.data, userId))
    .map((job) => ({
      jobId: job.id ?? null,
      name: job.name,
      type: job.data.type,
      state: "waiting" as CareerPipelineQueueState,
      stage: getCareerTreeStageForJobType(job.data.type),
      courseId: readJobCourseId(job.data),
      requestKey: readJobRequestKey(job.data),
      queuedAt: job.timestamp ? new Date(job.timestamp).toISOString() : null,
      processedAt: job.processedOn ? new Date(job.processedOn).toISOString() : null,
      attemptsMade: job.attemptsMade,
    }));
}

async function hydrateQueueJobStates(
  jobs: CareerTreePipelineQueueSummary[],
): Promise<CareerTreePipelineQueueSummary[]> {
  try {
    const queue = getCareerTreeQueue();
    return Promise.all(
      jobs.map(async (job) => ({
        ...job,
        state: normalizeQueueState(job.jobId ? await queue.getJobState(job.jobId) : "waiting"),
      })),
    );
  } catch (error) {
    writeStructuredLog("warn", "career_tree_pipeline_queue_state_unavailable", {
      workflow: "career-tree",
      jobCount: jobs.length,
      errorMessage: getErrorMessage(error),
    });
    return jobs.map((job) => ({ ...job, state: "unknown" }));
  }
}

function selectActiveStage(params: {
  queueJobs: CareerTreePipelineQueueSummary[];
  runningRuns: CareerTreePipelineRunSummary[];
  latestRun: CareerTreePipelineRunSummary | null;
}): CareerTreePipelineStage | null {
  const activeJob = params.queueJobs.find((job) => job.state === "active");
  if (activeJob) {
    return activeJob.stage;
  }

  const runningRun = [...params.runningRuns].sort(
    (left, right) => runStageRank[right.stage] - runStageRank[left.stage],
  )[0];
  if (runningRun) {
    return runningRun.stage;
  }

  const queuedJob = params.queueJobs[0];
  if (queuedJob) {
    return queuedJob.stage;
  }

  return params.latestRun?.stage ?? null;
}

function getLatestActivityAt(params: {
  queueJobs: CareerTreePipelineQueueSummary[];
  runs: Array<typeof careerGenerationRuns.$inferSelect>;
  readySnapshot: { generatedAt: Date | null; createdAt: Date } | null;
}): string | null {
  const dates = [
    ...params.queueJobs.flatMap((job) => [job.processedAt, job.queuedAt]),
    ...params.runs.map((run) => getRunActivityDate(run).toISOString()),
    params.readySnapshot?.generatedAt?.toISOString() ??
      params.readySnapshot?.createdAt.toISOString(),
  ].filter((value): value is string => Boolean(value));

  return dates.sort().at(-1) ?? null;
}

export async function getCareerTreePipelineStatus(
  userId: string,
): Promise<CareerTreePipelineStatus> {
  const [readySnapshots, runs, rawQueueJobs] = await Promise.all([
    getCurrentReadySnapshotSummary(userId),
    listCurrentCareerRuns(userId),
    listUserCareerTreeQueueJobs(userId),
  ]);
  const queueJobs = await hydrateQueueJobStates(rawQueueJobs);
  const currentRuns = runs.filter(isCurrentCareerRun);
  const latestRunRow = currentRuns[0] ?? null;
  const latestRun = latestRunRow ? summarizeRun(latestRunRow) : null;
  const runningRuns = currentRuns.filter((run) => run.status === "running").map(summarizeRun);
  const failedRunSummary = latestRunRow?.status === "failed" ? summarizeRun(latestRunRow) : null;
  const readySnapshot = readySnapshots[0] ?? null;
  const hasReadySnapshot = Boolean(readySnapshot);
  const activeQueueJobs = queueJobs.filter((job) => job.state === "active");
  const queuedQueueJobs = queueJobs.filter((job) =>
    ["waiting", "delayed", "prioritized"].includes(job.state),
  );
  const lastActivityAt = getLatestActivityAt({
    queueJobs,
    runs: currentRuns,
    readySnapshot,
  });
  const activeCount = activeQueueJobs.length + runningRuns.length;
  const queuedCount = queuedQueueJobs.length;
  const hasWork = activeCount > 0 || queuedCount > 0;
  const lastActivityTime = lastActivityAt ? new Date(lastActivityAt).getTime() : null;
  const isStalled =
    hasWork &&
    lastActivityTime !== null &&
    Date.now() - lastActivityTime > CAREER_TREE_PIPELINE_STALE_AFTER_MS;
  const state: CareerPipelineState = isStalled
    ? "stalled"
    : hasWork
      ? activeCount > 0
        ? "running"
        : "queued"
      : failedRunSummary
        ? "failed"
        : hasReadySnapshot
          ? "ready"
          : "idle";
  const stage = selectActiveStage({
    queueJobs,
    runningRuns,
    latestRun,
  });

  return {
    state,
    stage,
    message: formatPipelineMessage({
      state,
      stage,
      activeCount,
      queuedCount,
      failedRun: failedRunSummary,
    }),
    hasReadySnapshot,
    generatedAt: toIso(readySnapshot?.generatedAt) ?? toIso(readySnapshot?.createdAt),
    lastActivityAt,
    staleAfterMs: CAREER_TREE_PIPELINE_STALE_AFTER_MS,
    queue: {
      waiting: queueJobs.filter((job) => job.state === "waiting").length,
      active: activeQueueJobs.length,
      delayed: queueJobs.filter((job) => job.state === "delayed").length,
      prioritized: queueJobs.filter((job) => job.state === "prioritized").length,
      jobs: queueJobs,
    },
    runs: {
      latest: latestRun,
      running: runningRuns,
      failed: failedRunSummary,
    },
  };
}
