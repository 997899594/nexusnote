import { eq, sql } from "drizzle-orm";
import { careerUserGraphState, db } from "@/db";

type CareerGraphStateExecutor = Pick<typeof db, "insert" | "update">;

export async function getCareerGraphStateRow(userId: string) {
  return db.query.careerUserGraphState.findFirst({
    where: eq(careerUserGraphState.userId, userId),
  });
}

export async function bumpCareerGraphState(
  executor: CareerGraphStateExecutor,
  params: {
    userId: string;
    lastMergeRunId?: string | null;
  },
) {
  await executor
    .insert(careerUserGraphState)
    .values({
      userId: params.userId,
      graphVersion: 1,
      lastMergeRunId: params.lastMergeRunId ?? null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: careerUserGraphState.userId,
      set: {
        graphVersion: sql`${careerUserGraphState.graphVersion} + 1`,
        lastMergeRunId: params.lastMergeRunId ?? null,
        updatedAt: new Date(),
      },
    });
}
