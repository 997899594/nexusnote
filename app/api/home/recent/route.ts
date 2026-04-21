import { withAuth } from "@/lib/api";
import { getRecentItemsCached } from "@/lib/learning/recent-courses-data";

export const GET = withAuth(async (_request, { userId }) => {
  const items = await getRecentItemsCached(userId);
  return Response.json({ items });
});
