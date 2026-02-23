/**
 * GET /api/skills/recommend - 获取技能推荐
 */

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getRecommendedSkills } from "@/lib/skills";
import { handleError, APIError } from "@/lib/api";
import { RecommendQuerySchema } from "@/lib/skills/validation";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      throw new APIError("Unauthorized", 401, "UNAUTHORIZED");
    }

    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const { limit } = RecommendQuerySchema.parse(searchParams);

    const recommendations = await getRecommendedSkills(session.user.id, limit);

    return Response.json({
      recommendations,
      count: recommendations.length,
    });
  } catch (error) {
    return handleError(error);
  }
}
