/**
 * Save Course Profile API
 * 保存用户的课程画像（Interview Agent 的输出）
 */

import { auth } from "@/auth";
import { saveCourseProfile } from "@/lib/ai/profile/course-profile";
import type { OutlineData } from "@/lib/ai/profile/course-profile";

export const runtime = "nodejs";

interface SaveCourseProfileRequest {
  goal: string;
  background: string;
  targetOutcome: string;
  cognitiveStyle: string;
  outlineData: OutlineData;
  designReason: string;
}

export async function POST(req: Request) {
  try {
    // 认证检查
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: SaveCourseProfileRequest = await req.json();

    // 保存课程画像，返回 courseId
    const courseId = await saveCourseProfile({
      userId: session.user.id,
      goal: body.goal,
      background: body.background,
      targetOutcome: body.targetOutcome,
      cognitiveStyle: body.cognitiveStyle,
      outlineData: body.outlineData,
      designReason: body.designReason,
    });

    return Response.json({ courseId });
  } catch (error) {
    console.error("[POST /api/courses/profile]", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to save course profile" },
      { status: 500 }
    );
  }
}
