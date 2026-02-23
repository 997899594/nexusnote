/**
 * GET /api/skills/recommend - 获取技能推荐
 */

import type { NextRequest } from "next/server";
import { APIError, handleError } from "@/lib/api";
import { auth } from "@/lib/auth";
import { getRecommendedSkills } from "@/lib/skills";
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
