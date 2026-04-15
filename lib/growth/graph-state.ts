import { eq } from "drizzle-orm";
import { type db, userGrowthState } from "@/db";

type GrowthGraphStateTransaction = Pick<typeof db, "insert" | "query" | "update">;

export async function bumpGrowthGraphState(
  tx: GrowthGraphStateTransaction,
  params: {
    userId: string;
    lastMergeRunId?: string | null;
  },
): Promise<number> {
  const existingGraphState = await tx.query.userGrowthState.findFirst({
    where: eq(userGrowthState.userId, params.userId),
  });
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
