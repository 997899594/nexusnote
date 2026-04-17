import { eq } from "drizzle-orm";
import { type db as DbType, db, userGrowthState } from "@/db";

type GrowthGraphStateExecutor = Pick<typeof DbType, "query">;
type GrowthGraphStateTransaction = Pick<typeof DbType, "insert" | "query" | "update">;

export async function getGrowthGraphStateRow(
  userId: string,
  executor: GrowthGraphStateExecutor = db,
) {
  return executor.query.userGrowthState.findFirst({
    where: eq(userGrowthState.userId, userId),
  });
}

export async function bumpGrowthGraphState(
  tx: GrowthGraphStateTransaction,
  params: {
    userId: string;
    lastMergeRunId?: string | null;
  },
): Promise<number> {
  const existingGraphState = await getGrowthGraphStateRow(params.userId, tx);
  const nextGraphVersion = (existingGraphState?.graphVersion ?? 0) + 1;

  if (existingGraphState) {
    await tx
      .update(userGrowthState)
      .set({
        graphVersion: nextGraphVersion,
        lastMergeRunId: params.lastMergeRunId ?? existingGraphState.lastMergeRunId,
        updatedAt: new Date(),
      })
      .where(eq(userGrowthState.userId, params.userId));
  } else {
    await tx.insert(userGrowthState).values({
      userId: params.userId,
      graphVersion: nextGraphVersion,
      lastMergeRunId: params.lastMergeRunId ?? null,
      updatedAt: new Date(),
    });
  }

  return nextGraphVersion;
}
