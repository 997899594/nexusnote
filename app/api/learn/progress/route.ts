import { and, eq, isNotNull } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { courseOutlineNodes, courseSections, db } from "@/db";
import { badRequest, notFound, parseJsonBodyAs, withAuth } from "@/lib/api";
import { revalidateCourseProgressViews } from "@/lib/cache/domain-events";
import { getOwnedCourseWithOutline } from "@/lib/learning/course-repository";
import { completeLearningSection } from "@/lib/learning/section-completion";

const CompleteSectionSchema = z.object({
  courseId: z.string().uuid(),
  sectionNodeId: z.string().uuid(),
});

async function getOwnedCourseOrThrow(userId: string, courseId: string) {
  const course = await getOwnedCourseWithOutline(courseId, userId);
  if (!course) throw notFound("课程不存在", "COURSE_NOT_FOUND");
  return course;
}

export const POST = withAuth(async (request: NextRequest, { userId }) => {
  const { courseId, sectionNodeId } = await parseJsonBodyAs(request, CompleteSectionSchema);
  const course = await getOwnedCourseOrThrow(userId, courseId);
  const sectionIndex = course.outline.chapters.flatMap((chapter, chapterIndex) =>
    chapter.sections.flatMap((section, sectionIndex) =>
      section.nodeId
        ? [
            {
              chapter,
              section,
              chapterIndex,
              sectionIndex,
              sectionId: section.nodeId,
            },
          ]
        : [],
    ),
  );
  const completedSection = sectionIndex.find((item) => item.sectionId === sectionNodeId);
  if (!completedSection) throw badRequest("课程小节不存在", "SECTION_NOT_FOUND");
  const [materializedSection] = await db
    .select({ id: courseSections.id })
    .from(courseSections)
    .innerJoin(courseOutlineNodes, eq(courseSections.outlineNodeId, courseOutlineNodes.id))
    .where(
      and(
        eq(courseSections.outlineVersionId, course.outlineVersionId),
        eq(courseOutlineNodes.semanticId, sectionNodeId),
        isNotNull(courseSections.contentMarkdown),
      ),
    )
    .limit(1);
  if (!materializedSection) throw badRequest("课程小节尚未生成", "SECTION_NOT_READY");

  const transition = await completeLearningSection({
    enrollment: {
      userId,
      courseId,
      sourceType: "course_revision",
      outlineVersionId: course.outlineVersionId,
    },
    outlineVersionId: course.outlineVersionId,
    sourceVersionHash: course.outlineVersionHash,
    courseTitle: course.title,
    section: {
      id: sectionNodeId,
      title: completedSection.section.title,
      index: completedSection.sectionIndex,
    },
    chapter: {
      id: completedSection.chapter.nodeId,
      title: completedSection.chapter.title,
      index: completedSection.chapterIndex,
    },
    allSectionIds: sectionIndex.map((section) => section.sectionId),
    activitySource: "progress_transition",
  });

  const completedSet = new Set(transition.completedSectionIds);
  const completedChapters = course.outline.chapters.flatMap((chapter, chapterIndex) =>
    chapter.sections.length > 0 &&
    chapter.sections.every((section) => section.nodeId && completedSet.has(section.nodeId))
      ? [chapterIndex]
      : [],
  );

  revalidateCourseProgressViews(userId, courseId);
  return Response.json({
    ok: true,
    alreadyCompleted: !transition.newSectionCompleted,
    completedSections: transition.completedSectionIds,
    completedChapters,
    courseCompleted: transition.courseCompleted,
  });
});
