import { and, desc, eq, isNull, lt, ne, or, sql } from "drizzle-orm";
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
const CAREER_RUN_LEASE_MS = 5 * 60 * 1000;
const CAREER_RUN_LEASE_HEARTBEAT_MS = 30 * 1000;

export type CareerRunAcquisition =
  | { state: "acquired"; run: CareerGenerationRun; fencingToken: string }
  | { state: "completed"; run: CareerGenerationRun; fencingToken: null }
  | { state: "busy"; run: CareerGenerationRun; fencingToken: null };

export class CareerRunLeaseLostError extends Error {
  constructor(runId: string) {
    super(`Career generation run lease was lost: ${runId}`);
    this.name = "CareerRunLeaseLostError";
  }
}

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
    fencingToken: string;
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
      leaseToken: null,
      leaseExpiresAt: null,
    })
    .where(
      and(
        eq(careerGenerationRuns.id, params.runId),
        eq(careerGenerationRuns.leaseToken, params.fencingToken),
        eq(careerGenerationRuns.status, "running"),
      ),
    )
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

export async function acquireCareerRun(params: {
  userId: string;
  courseId?: string;
  kind: string;
  idempotencyKey: string;
  inputHash: string;
  model: string;
  promptVersion: string;
  reuseCompleted?: boolean;
}): Promise<CareerRunAcquisition> {
  const fencingToken = crypto.randomUUID();
  const startedAt = new Date();
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
      startedAt,
      leaseToken: fencingToken,
      leaseExpiresAt: new Date(startedAt.getTime() + CAREER_RUN_LEASE_MS),
      attemptCount: 1,
    })
    .onConflictDoNothing()
    .returning();

  if (created) {
    logCareerRunStarted(created, { previousStatus: null });
    return { state: "acquired", run: created, fencingToken };
  }

  const existing = await getCareerRunByIdempotencyKey(params.idempotencyKey);
  if (!existing) {
    throw new Error(`Missing career generation run after conflict: ${params.idempotencyKey}`);
  }

  if (params.reuseCompleted && existing.status === "succeeded") {
    return { state: "completed", run: existing, fencingToken: null };
  }

  const [acquired] = await db
    .update(careerGenerationRuns)
    .set({
      status: "running",
      startedAt,
      finishedAt: null,
      errorCode: null,
      errorMessage: null,
      leaseToken: fencingToken,
      leaseExpiresAt: new Date(startedAt.getTime() + CAREER_RUN_LEASE_MS),
      attemptCount: sql`${careerGenerationRuns.attemptCount} + 1`,
    })
    .where(
      and(
        eq(careerGenerationRuns.id, existing.id),
        or(
          ne(careerGenerationRuns.status, "running"),
          isNull(careerGenerationRuns.leaseToken),
          isNull(careerGenerationRuns.leaseExpiresAt),
          lt(careerGenerationRuns.leaseExpiresAt, startedAt),
        ),
      ),
    )
    .returning();

  if (acquired) {
    logCareerRunStarted(acquired, { previousStatus: existing.status });
    return { state: "acquired", run: acquired, fencingToken };
  }

  const current = (await getCareerRunById(existing.id)) ?? existing;
  return { state: "busy", run: current, fencingToken: null };
}

export function startCareerRunLeaseHeartbeat(params: {
  runId: string;
  fencingToken: string;
}): () => void {
  const renew = async () => {
    const [renewed] = await db
      .update(careerGenerationRuns)
      .set({ leaseExpiresAt: new Date(Date.now() + CAREER_RUN_LEASE_MS) })
      .where(
        and(
          eq(careerGenerationRuns.id, params.runId),
          eq(careerGenerationRuns.leaseToken, params.fencingToken),
          eq(careerGenerationRuns.status, "running"),
        ),
      )
      .returning({ id: careerGenerationRuns.id });
    if (!renewed) throw new CareerRunLeaseLostError(params.runId);
  };

  const timer = setInterval(() => {
    void renew().catch((error) =>
      writeStructuredLog("error", "career_tree_run_lease_renewal_failed", {
        runId: params.runId,
        ...buildErrorLogFields(error),
      }),
    );
  }, CAREER_RUN_LEASE_HEARTBEAT_MS);
  return () => clearInterval(timer);
}

export async function markCareerRunSucceeded(
  executor: CareerRunExecutor,
  runId: string,
  fencingToken: string,
  outputJson: unknown,
) {
  const updated = await updateCareerRunStatus(executor, {
    runId,
    fencingToken,
    status: "succeeded",
    outputJson,
    finishedAt: new Date(),
    errorCode: null,
    errorMessage: null,
  });

  if (!updated) throw new CareerRunLeaseLostError(runId);
  logCareerRunSucceeded(updated);
}

export async function markCareerRunFailed(
  runId: string,
  fencingToken: string,
  error: unknown,
  options: CareerRunFailureOptions = { final: true },
) {
  const updated = await updateCareerRunStatus(db, {
    runId,
    fencingToken,
    status: options.final ? "failed" : "running",
    finishedAt: options.final ? new Date() : null,
    errorCode: normalizeAIError(error).code,
    errorMessage: getErrorMessage(error),
  });
  if (options.final && updated) {
    logCareerRunFailure(updated, error, options);
  }
}
