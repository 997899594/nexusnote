import { z } from "zod";
import { withAuth } from "@/lib/api";
import { revalidateGoldenPath } from "@/lib/cache/tags";
import { setSelectedCareerTreeDirection } from "@/lib/career-tree/preference-write";
import { enqueueCareerTreeCompose } from "@/lib/career-tree/queue";
import { getCareerTreeSnapshot } from "@/lib/career-tree/snapshot";

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
