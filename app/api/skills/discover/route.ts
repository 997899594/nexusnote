/**
 * POST /api/skills/discover - 触发技能发现
 *
 * 从用户数据中发现技能并保存到数据库
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { discoverAndSaveSkills, discoverAndSaveRelationships } from "@/lib/skills";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const options = {
      limit: body.limit || 50,
      sources: body.sources as Array<"conversations" | "knowledge" | "courses" | "flashcards"> | undefined,
    };

    // 发现技能
    const discoveredSkills = await discoverAndSaveSkills(session.user.id, options);

    // 发现关系（异步，不阻塞响应）
    discoverAndSaveRelationships(undefined, session.user.id).catch((error) => {
      console.error("[API] /api/skills/discover relationships error:", error);
    });

    return NextResponse.json({
      success: true,
      skills: discoveredSkills,
      count: discoveredSkills.length,
    });
  } catch (error) {
    console.error("[API] /api/skills/discover error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
