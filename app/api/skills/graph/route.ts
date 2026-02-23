/**
 * GET /api/skills/graph - 获取用户技能图数据
 */

import type { NextRequest } from "next/server";
import { APIError, handleError } from "@/lib/api";
import { auth } from "@/lib/auth";
import { getUserSkillGraphData } from "@/lib/skills";
import { GraphQuerySchema } from "@/lib/skills/validation";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      throw new APIError("Unauthorized", 401, "UNAUTHORIZED");
    }

    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const options = GraphQuerySchema.parse(searchParams);

    const graphData = await getUserSkillGraphData(session.user.id, options);

    return Response.json(graphData);
  } catch (error) {
    return handleError(error);
  }
}
