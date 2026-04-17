import { and, desc, eq } from "drizzle-orm";
import { db, knowledgeGenerationRuns } from "@/db";

type GenerationRunExecutor = Pick<typeof db, "update">;
type GenerationRunStatus = typeof knowledgeGenerationRuns.$inferSelect.status;

function getGenerationRunErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

async function getGenerationRunByIdempotencyKey(idempotencyKey: string) {
  return db.query.knowledgeGenerationRuns.findFirst({
    where: eq(knowledgeGenerationRuns.idempotencyKey, idempotencyKey),
  });
}

async function updateGenerationRunStatus(
  executor: GenerationRunExecutor,
  params: {
    runId: string;
    status: GenerationRunStatus;
    outputJson?: unknown;
    errorCode?: string | null;
    errorMessage?: string | null;
    startedAt?: Date | null;
    finishedAt?: Date | null;
  },
) {
  await executor
    .update(knowledgeGenerationRuns)
    .set({
      status: params.status,
      ...(params.outputJson !== undefined && { outputJson: params.outputJson }),
      ...(params.startedAt !== undefined && { startedAt: params.startedAt }),
      ...(params.finishedAt !== undefined && { finishedAt: params.finishedAt }),
      ...(params.errorCode !== undefined && { errorCode: params.errorCode }),
      ...(params.errorMessage !== undefined && { errorMessage: params.errorMessage }),
    })
    .where(eq(knowledgeGenerationRuns.id, params.runId));
}

export async function getGenerationRunById(runId: string) {
  return db.query.knowledgeGenerationRuns.findFirst({
    where: eq(knowledgeGenerationRuns.id, runId),
  });
}

export async function getLatestSucceededGenerationRun(params: {
  userId: string;
  courseId?: string;
  kind: string;
}) {
  return db.query.knowledgeGenerationRuns.findFirst({
    where: and(
      eq(knowledgeGenerationRuns.userId, params.userId),
      params.courseId ? eq(knowledgeGenerationRuns.courseId, params.courseId) : undefined,
      eq(knowledgeGenerationRuns.kind, params.kind),
      eq(knowledgeGenerationRuns.status, "succeeded"),
    ),
    orderBy: desc(knowledgeGenerationRuns.createdAt),
  });
}

export async function getOrCreateGenerationRun(params: {
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
    .insert(knowledgeGenerationRuns)
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

  const existing = await getGenerationRunByIdempotencyKey(params.idempotencyKey);

  if (!existing) {
    throw new Error(`Missing generation run after conflict: ${params.idempotencyKey}`);
  }

  if (params.reuseCompleted && existing.status === "succeeded") {
    return existing;
  }

  if (existing.status !== "running") {
    await updateGenerationRunStatus(db, {
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

export async function markGenerationRunSucceeded(
  executor: GenerationRunExecutor,
  runId: string,
  outputJson: unknown,
) {
  await updateGenerationRunStatus(executor, {
    runId,
    status: "succeeded",
    outputJson,
    finishedAt: new Date(),
    errorCode: null,
    errorMessage: null,
  });
}

export async function markGenerationRunFailed(runId: string, error: unknown) {
  await updateGenerationRunStatus(db, {
    runId,
    status: "failed",
    finishedAt: new Date(),
    errorCode: "JOB_FAILED",
    errorMessage: getGenerationRunErrorMessage(error),
  });
}
