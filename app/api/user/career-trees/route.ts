import { z } from "zod";
import { withAuth } from "@/lib/api";
import { revalidateCareerTrees } from "@/lib/cache/tags";
import { setSelectedGrowthDirection } from "@/lib/growth/preferences";
import { enqueueGrowthCompose } from "@/lib/growth/queue";
import { getGrowthSnapshot } from "@/lib/growth/snapshot-data";
import { ingestEvidenceEvent } from "@/lib/knowledge/events";

const selectCareerTreeDirectionSchema = z.object({
  selectedDirectionKey: z.string().trim().min(1),
});

export const GET = withAuth(async (_request, { userId }) => {
  const snapshot = await getGrowthSnapshot(userId);
  if (snapshot.status === "pending") {
    await enqueueGrowthCompose(userId);
  }
  return Response.json(snapshot);
});

export const PUT = withAuth(async (request, { userId }) => {
  const body = await request.json();
  const { selectedDirectionKey } = selectCareerTreeDirectionSchema.parse(body);

  await setSelectedGrowthDirection(userId, selectedDirectionKey);
  await ingestEvidenceEvent({
    id: crypto.randomUUID(),
    userId,
    kind: "user_preference",
    sourceType: "growth_preference",
    sourceId: selectedDirectionKey,
    sourceVersionHash: null,
    title: `职业树偏好 · ${selectedDirectionKey}`,
    summary: `将 ${selectedDirectionKey} 设为当前职业树偏好`,
    confidence: 1,
    happenedAt: new Date().toISOString(),
    metadata: {
      selectedDirectionKey,
    },
    refs: [
      {
        refType: "direction_key",
        refId: selectedDirectionKey,
        weight: 1,
      },
    ],
  });
  await enqueueGrowthCompose(userId);
  revalidateCareerTrees(userId);

  return Response.json(
    {
      accepted: true,
      selectedDirectionKey,
    },
    { status: 202 },
  );
});
