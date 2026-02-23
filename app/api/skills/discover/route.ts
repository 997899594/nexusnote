/**
 * POST /api/skills/discover - 触发技能发现
 *
 * 从用户数据中发现技能并保存到数据库
 */

import { type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { discoverAndSaveSkills, discoverAndSaveRelationships } from "@/lib/skills";
import { handleError, APIError } from "@/lib/api";
import { DiscoverSkillsSchema } from "@/lib/skills/validation";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      throw new APIError("Unauthorized", 401, "UNAUTHORIZED");
    }

    const body = await request.json();
    const options = DiscoverSkillsSchema.parse(body);

    // 发现技能
    const discoveredSkills = await discoverAndSaveSkills(session.user.id, options);

    // 发现关系（异步，不阻塞响应）
    discoverAndSaveRelationships(undefined, session.user.id).catch((error) => {
      console.error("[API] /api/skills/discover relationships error:", error);
    });

    return Response.json({
      success: true,
      skills: discoveredSkills,
      count: discoveredSkills.length,
    });
  } catch (error) {
    return handleError(error);
  }
}
