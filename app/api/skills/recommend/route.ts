/**
 * GET /api/skills/recommend - 获取技能推荐
 */

import { withAuth } from "@/lib/api";
import { getRecommendedSkills } from "@/lib/skills";
import { RecommendQuerySchema } from "@/lib/skills/validation";

export const GET = withAuth(async (request, { userId }) => {
  const searchParams = Object.fromEntries(request.nextUrl.searchParams);
  const { limit } = RecommendQuerySchema.parse(searchParams);

  const recommendations = await getRecommendedSkills(userId, limit);

  return Response.json({
    recommendations,
    count: recommendations.length,
  });
});
