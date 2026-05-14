import { and, desc, eq } from "drizzle-orm";
import { careerGenerationRuns, db } from "@/db";

type CareerRunExecutor = Pick<typeof db, "update">;
type CareerRunStatus = typeof careerGenerationRuns.$inferSelect.status;

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
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
) {
  await executor
    .update(careerGenerationRuns)
    .set({
      status: params.status,
      ...(params.outputJson !== undefined && { outputJson: params.outputJson }),
      ...(params.startedAt !== undefined && { startedAt: params.startedAt }),
      ...(params.finishedAt !== undefined && { finishedAt: params.finishedAt }),
      ...(params.errorCode !== undefined && { errorCode: params.errorCode }),
      ...(params.errorMessage !== undefined && { errorMessage: params.errorMessage }),
    })
    .where(eq(careerGenerationRuns.id, params.runId));
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
    await updateCareerRunStatus(db, {
      runId: existing.id,
      status: "running",
      startedAt: new Date(),
      finishedAt: null,
      errorCode: null,
      errorMessage: null,
    });

    return {
      ...existing,
      status: "running" as const,
    };
  }

  return existing;
}

export async function markCareerRunSucceeded(
  executor: CareerRunExecutor,
  runId: string,
  outputJson: unknown,
) {
  await updateCareerRunStatus(executor, {
    runId,
    status: "succeeded",
    outputJson,
    finishedAt: new Date(),
    errorCode: null,
    errorMessage: null,
  });
}

export async function markCareerRunFailed(runId: string, error: unknown) {
  await updateCareerRunStatus(db, {
    runId,
    status: "failed",
    finishedAt: new Date(),
    errorCode: "JOB_FAILED",
    errorMessage: getErrorMessage(error),
  });
}
