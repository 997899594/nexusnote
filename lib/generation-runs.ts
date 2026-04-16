import { eq } from "drizzle-orm";
import { db, knowledgeGenerationRuns } from "@/db";

type GenerationRunExecutor = Pick<typeof db, "update">;

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

  const existing = await db.query.knowledgeGenerationRuns.findFirst({
    where: eq(knowledgeGenerationRuns.idempotencyKey, params.idempotencyKey),
  });

  if (!existing) {
    throw new Error(`Missing generation run after conflict: ${params.idempotencyKey}`);
  }

  if (params.reuseCompleted && existing.status === "succeeded") {
    return existing;
  }

  if (existing.status !== "running") {
    await db
      .update(knowledgeGenerationRuns)
      .set({
        status: "running",
        startedAt: new Date(),
        finishedAt: null,
        errorCode: null,
        errorMessage: null,
      })
      .where(eq(knowledgeGenerationRuns.id, existing.id));

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
  await executor
    .update(knowledgeGenerationRuns)
    .set({
      status: "succeeded",
      outputJson,
      finishedAt: new Date(),
      errorCode: null,
      errorMessage: null,
    })
    .where(eq(knowledgeGenerationRuns.id, runId));
}

export async function markGenerationRunFailed(runId: string, error: unknown) {
  await db
    .update(knowledgeGenerationRuns)
    .set({
      status: "failed",
      finishedAt: new Date(),
      errorCode: "JOB_FAILED",
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    })
    .where(eq(knowledgeGenerationRuns.id, runId));
}
