import { z } from "zod";
import { withAuth } from "@/lib/api";
import { revalidateCareerTrees } from "@/lib/cache/tags";
import { setSelectedCareerTreeDirection } from "@/lib/career-tree/preferences";
import { enqueueCareerTreeCompose } from "@/lib/career-tree/queue";
import { getCareerTreeSnapshot } from "@/lib/career-tree/snapshot";
import { ingestEvidenceEvent } from "@/lib/knowledge/events";

const selectCareerTreeDirectionSchema = z.object({
  selectedDirectionKey: z.string().trim().min(1),
});

export const GET = withAuth(async (_request, { userId }) => {
  return Response.json(await getCareerTreeSnapshot(userId));
});

export const PUT = withAuth(async (request, { userId }) => {
  const body = await request.json();
  const { selectedDirectionKey } = selectCareerTreeDirectionSchema.parse(body);
  const snapshot = await getCareerTreeSnapshot(userId);
  const directionExists = snapshot.trees.some((tree) => tree.directionKey === selectedDirectionKey);

  if (snapshot.status !== "ready" || !directionExists) {
    return Response.json(
      {
        error: "selected_direction_not_available",
      },
      { status: 409 },
    );
  }

  await setSelectedCareerTreeDirection(userId, selectedDirectionKey);
  await ingestEvidenceEvent({
    id: crypto.randomUUID(),
    userId,
    kind: "user_preference",
    sourceType: "career_tree_preference",
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
  await enqueueCareerTreeCompose(userId);
  revalidateCareerTrees(userId);

  return Response.json(
    {
      accepted: true,
      selectedDirectionKey,
    },
    { status: 202 },
  );
});
