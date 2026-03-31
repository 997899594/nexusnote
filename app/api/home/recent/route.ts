import { withAuth } from "@/lib/api";
import { getRecentItemsCached } from "@/lib/server/home-data";

export const GET = withAuth(async (_request, { userId }) => {
  const items = await getRecentItemsCached(userId);
  return Response.json({ items });
});
