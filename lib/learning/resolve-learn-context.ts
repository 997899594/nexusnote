import { getOwnedCourseWithOutline } from "@/lib/learning/course-repository";
import { createLearnTrace } from "@/lib/learning/observability";

export interface ResolvedLearnContext {
  courseId: string;
  courseTitle: string;
  chapterIndex: number;
  chapterTitle: string;
  chapterDescription: string;
  courseSkillIds: string[];
  chapterSkillIds: string[];
  sectionTitles: string[];
}

export async function resolveOwnedLearnContext({
  userId,
  courseId,
  chapterIndex,
  traceId,
}: {
  userId: string;
  courseId: string;
  chapterIndex: number;
  traceId?: string;
}): Promise<ResolvedLearnContext | null> {
  const trace = createLearnTrace(
    "resolve-context",
    {
      userId,
      courseId,
      chapterIndex,
    },
    traceId,
  );

  const course = await getOwnedCourseWithOutline(courseId, userId);

  if (!course) {
    trace.finish({
      found: false,
    });
    return null;
  }

  const chapter = course.outline.chapters[chapterIndex];
  const chapterTitle = chapter?.title?.trim() || `第 ${chapterIndex + 1} 章`;
  const chapterDescription = chapter?.description?.trim() || "";
  const courseSkillIds = course.outline.courseSkillIds ?? [];
  const chapterSkillIds = chapter?.skillIds ?? [];
  const sectionTitles =
    chapter?.sections.map((section) => section.title.trim()).filter(Boolean) ?? [];

  trace.finish({
    found: true,
    chapterTitle,
    hasChapterDescription: chapterDescription.length > 0,
    courseSkillCount: courseSkillIds.length,
    chapterSkillCount: chapterSkillIds.length,
    sectionCount: sectionTitles.length,
  });

  return {
    courseId,
    courseTitle: course.title,
    chapterIndex,
    chapterTitle,
    chapterDescription,
    courseSkillIds,
    chapterSkillIds,
    sectionTitles,
  };
}
