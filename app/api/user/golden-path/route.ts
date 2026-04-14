import { z } from "zod";
import { withAuth } from "@/lib/api";
import { revalidateGoldenPath } from "@/lib/cache/tags";
import { setSelectedCareerTreeDirection } from "@/lib/career-tree/preference-write";
import { enqueueCareerTreeCompose } from "@/lib/career-tree/queue";
import { getCareerTreeSnapshot } from "@/lib/career-tree/snapshot";
import { ingestEvidenceEvent } from "@/lib/knowledge/events";

const SelectCareerTreeSchema = z
  .object({
    selectedDirectionKey: z.string().trim().min(1).optional(),
    // Temporary compatibility for the current UI while the new read model is landing.
    routeId: z.string().trim().min(1).optional(),
  })
  .transform((input) => ({
    selectedDirectionKey: input.selectedDirectionKey ?? input.routeId,
  }))
  .pipe(
    z.object({
      selectedDirectionKey: z.string().trim().min(1),
    }),
  );

export const GET = withAuth(async (_request, { userId }) => {
  const snapshot = await getCareerTreeSnapshot(userId);
  if (snapshot.status === "pending") {
    await enqueueCareerTreeCompose(userId);
  }
  return Response.json(snapshot);
});

export const PUT = withAuth(async (request, { userId }) => {
  const body = await request.json();
  const { selectedDirectionKey } = SelectCareerTreeSchema.parse(body);

  await setSelectedCareerTreeDirection(userId, selectedDirectionKey);
  await ingestEvidenceEvent({
    id: crypto.randomUUID(),
    userId,
    kind: "user_preference",
    sourceType: "career_tree",
    sourceId: selectedDirectionKey,
    sourceVersionHash: null,
    title: "选择当前职业树",
    summary: selectedDirectionKey,
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
  revalidateGoldenPath(userId);

  return Response.json(
    {
      accepted: true,
      selectedDirectionKey,
    },
    { status: 202 },
  );
});
