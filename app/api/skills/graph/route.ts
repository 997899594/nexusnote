/**
 * GET /api/skills/graph - 获取用户技能图数据
 */

import { withAuth } from "@/lib/api";
import { getUserSkillGraphData } from "@/lib/skills";
import { GraphQuerySchema } from "@/lib/skills/validation";

export const GET = withAuth(async (request, { userId }) => {
  const searchParams = Object.fromEntries(request.nextUrl.searchParams);
  const options = GraphQuerySchema.parse(searchParams);
  const graphData = await getUserSkillGraphData(userId, options);
  return Response.json(graphData);
});
