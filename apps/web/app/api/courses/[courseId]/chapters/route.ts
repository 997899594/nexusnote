/**
 * Get Course Chapters API
 * 获取特定课程的所有章节
 */

import { auth } from "@/auth";
import { getCourseChapters } from "@/lib/ai/profile/course-profile";
import { db, courseProfiles, courseChapters, eq } from "@nexusnote/db";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ courseId: string }> },
) {
  try {
    const { courseId } = await params;

    // 1. 认证检查
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. 权限审计：确保用户只能访问自己的课程
    const profile = await db.query.courseProfiles.findFirst({
      where: eq(courseProfiles.id, courseId),
    });

    if (!profile) {
      console.error(`[Security] Course ${courseId} not found`);
      return Response.json({ error: "Course not found" }, { status: 404 });
    }

    if (profile.userId !== session.user.id) {
      console.error(
        `[Security] Unauthorized access attempt: User ${session.user.id} tried to access Course ${courseId} owned by ${profile.userId}`,
      );
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    // 3. 显式查询：避免 db.query 可能存在的 Schema 缓存问题
    const chapters = await db
      .select()
      .from(courseChapters)
      .where(eq(courseChapters.profileId, courseId))
      .orderBy(courseChapters.chapterIndex, courseChapters.sectionIndex);

    console.log(
      `[GET /api/courses/${courseId}/chapters] Success: Found ${chapters.length} chapters for User ${session.user.id}`,
    );

    return Response.json({
      chapters,
      profile: {
        id: profile.id,
        title: profile.title,
        progress: {
          currentChapter: profile.currentChapter,
          currentSection: profile.currentSection,
        },
      },
    });
  } catch (error) {
    console.error("[GET /api/courses/[courseId]/chapters]", error);
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to fetch chapters",
      },
      { status: 500 },
    );
  }
}
