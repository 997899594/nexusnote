import { and, desc, eq } from "drizzle-orm";
import { careerGenerationRuns, db } from "@/db";
import { normalizeAIError } from "@/lib/ai/core/ai-errors";
import {
  buildErrorLogFields,
  getErrorMessage,
  writeStructuredLog,
} from "@/lib/observability/structured-log";

type CareerRunExecutor = Pick<typeof db, "update">;
type CareerRunStatus = typeof careerGenerationRuns.$inferSelect.status;
type CareerGenerationRun = typeof careerGenerationRuns.$inferSelect;

export interface CareerRunFailureOptions {
  final: boolean;
  attemptNumber?: number;
  maxAttempts?: number;
}

function buildCareerRunLogFields(run: CareerGenerationRun | null): Record<string, unknown> {
  return {
    runId: run?.id ?? null,
    kind: run?.kind ?? null,
    status: run?.status ?? null,
    userId: run?.userId ?? null,
    courseId: run?.courseId ?? null,
    model: run?.model ?? null,
    promptVersion: run?.promptVersion ?? null,
    inputHash: run?.inputHash ?? null,
    startedAt: run?.startedAt?.toISOString() ?? null,
    finishedAt: run?.finishedAt?.toISOString() ?? null,
    createdAt: run?.createdAt?.toISOString() ?? null,
  };
}

function logCareerRunStarted(
  run: CareerGenerationRun | null,
  params: { previousStatus?: CareerRunStatus | null },
) {
  writeStructuredLog("info", "career_tree_run_started", {
    ...buildCareerRunLogFields(run),
    previousStatus: params.previousStatus ?? null,
  });
}

function logCareerRunSucceeded(run: CareerGenerationRun | null) {
  writeStructuredLog("info", "career_tree_run_succeeded", buildCareerRunLogFields(run));
}

function logCareerRunFailure(
  run: CareerGenerationRun | null,
  error: unknown,
  options: CareerRunFailureOptions,
) {
  writeStructuredLog("error", "career_tree_run_failed", {
    ...buildCareerRunLogFields(run),
    final: options.final,
    attemptNumber: options.attemptNumber ?? null,
    maxAttempts: options.maxAttempts ?? null,
    ...buildErrorLogFields(error),
  });
}

async function getCareerRunByIdempotencyKey(idempotencyKey: string) {
  return db.query.careerGenerationRuns.findFirst({
    where: eq(careerGenerationRuns.idempotencyKey, idempotencyKey),
  });
}

async function updateCareerRunStatus(
  executor: CareerRunExecutor,
  params: {
    runId: string;
    status: CareerRunStatus;
    outputJson?: unknown;
    errorCode?: string | null;
    errorMessage?: string | null;
    startedAt?: Date | null;
    finishedAt?: Date | null;
  },
): Promise<CareerGenerationRun | null> {
  const [updated] = await executor
    .update(careerGenerationRuns)
    .set({
      status: params.status,
      ...(params.outputJson !== undefined && { outputJson: params.outputJson }),
      ...(params.startedAt !== undefined && { startedAt: params.startedAt }),
      ...(params.finishedAt !== undefined && { finishedAt: params.finishedAt }),
      ...(params.errorCode !== undefined && { errorCode: params.errorCode }),
      ...(params.errorMessage !== undefined && { errorMessage: params.errorMessage }),
    })
    .where(eq(careerGenerationRuns.id, params.runId))
    .returning();

  return updated ?? null;
}

export async function getCareerRunById(runId: string) {
  return db.query.careerGenerationRuns.findFirst({
    where: eq(careerGenerationRuns.id, runId),
  });
}

export async function getLatestSucceededCareerRun(params: {
  userId: string;
  courseId?: string;
  kind: string;
}) {
  return db.query.careerGenerationRuns.findFirst({
    where: and(
      eq(careerGenerationRuns.userId, params.userId),
      params.courseId ? eq(careerGenerationRuns.courseId, params.courseId) : undefined,
      eq(careerGenerationRuns.kind, params.kind),
      eq(careerGenerationRuns.status, "succeeded"),
    ),
    orderBy: desc(careerGenerationRuns.createdAt),
  });
}

export async function getOrCreateCareerRun(params: {
  userId: string;
  courseId?: string;
  kind: string;
  idempotencyKey: string;
  inputHash: string;
  model: string;
  promptVersion: string;
  reuseCompleted?: boolean;
}) {
  const [created] = await db
    .insert(careerGenerationRuns)
    .values({
      userId: params.userId,
      courseId: params.courseId,
      kind: params.kind,
      status: "running",
      idempotencyKey: params.idempotencyKey,
      model: params.model,
      promptVersion: params.promptVersion,
      inputHash: params.inputHash,
      startedAt: new Date(),
    })
    .onConflictDoNothing()
    .returning();

  if (created) {
    logCareerRunStarted(created, { previousStatus: null });
    return created;
  }

  const existing = await getCareerRunByIdempotencyKey(params.idempotencyKey);
  if (!existing) {
    throw new Error(`Missing career generation run after conflict: ${params.idempotencyKey}`);
  }

  if (params.reuseCompleted && existing.status === "succeeded") {
    return existing;
  }

  if (existing.status !== "running") {
    const startedAt = new Date();
    const updated = await updateCareerRunStatus(db, {
      runId: existing.id,
      status: "running",
      startedAt,
      finishedAt: null,
      errorCode: null,
      errorMessage: null,
    });

    const restarted = updated ?? {
      ...existing,
      status: "running" as const,
      startedAt,
      finishedAt: null,
      errorCode: null,
      errorMessage: null,
    };

    logCareerRunStarted(restarted, { previousStatus: existing.status });

    return restarted;
  }

  return existing;
}

export async function markCareerRunSucceeded(
  executor: CareerRunExecutor,
  runId: string,
  outputJson: unknown,
) {
  const updated = await updateCareerRunStatus(executor, {
    runId,
    status: "succeeded",
    outputJson,
    finishedAt: new Date(),
    errorCode: null,
    errorMessage: null,
  });

  logCareerRunSucceeded(updated);
}

export async function markCareerRunFailed(
  runId: string,
  error: unknown,
  options: CareerRunFailureOptions = { final: true },
) {
  if (options.final) {
    try {
      const run = await getCareerRunById(runId);
      logCareerRunFailure(run ?? null, error, options);
    } catch (logError) {
      console.error(
        JSON.stringify({
          level: "error",
          event: "career_tree_run_failure_log_failed",
          runId,
          attemptNumber: options.attemptNumber ?? null,
          maxAttempts: options.maxAttempts ?? null,
          errorMessage: getErrorMessage(logError),
          originalErrorMessage: getErrorMessage(error),
        }),
      );
    }
  }

  await updateCareerRunStatus(db, {
    runId,
    status: options.final ? "failed" : "running",
    finishedAt: options.final ? new Date() : null,
    errorCode: normalizeAIError(error).code,
    errorMessage: getErrorMessage(error),
  });
}
