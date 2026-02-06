/**
 * Get Course Chapters API
 * 获取特定课程的所有章节
 */

import { auth } from "@/auth";
import { getCourseChapters } from "@/lib/ai/profile/course-profile";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    // 认证检查
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { courseId } = await params;

    // 获取课程章节
    const chapters = await getCourseChapters(courseId);

    return Response.json({ chapters });
  } catch (error) {
    console.error("[GET /api/courses/[courseId]/chapters]", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to fetch chapters" },
      { status: 500 }
    );
  }
}
