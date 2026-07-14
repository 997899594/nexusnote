import type { NextRequest } from "next/server";
import { z } from "zod";
import { badRequest, notFound, parseJsonBodyAs, withDynamicAuth } from "@/lib/api";
import {
  revalidateCareerTrees,
  revalidateProfileStats,
  revalidateRecentCourses,
} from "@/lib/cache/tags";
import { getPublicCourseProgressTarget } from "@/lib/learning/course-sharing";
import { completeLearningSection } from "@/lib/learning/section-completion";

interface RouteParams {
  slug: string;
}

const CompletedSectionSchema = z.object({ sectionNodeId: z.string().uuid() });

function handleProgressError(error: unknown): never {
  if (error instanceof Error && error.message === "COURSE_PUBLICATION_NOT_FOUND") {
    throw notFound("公开课程不存在", "COURSE_PUBLICATION_NOT_FOUND");
  }
  if (error instanceof Error && error.message === "COURSE_PUBLICATION_SUBSCRIPTION_REQUIRED") {
    throw notFound("请先订阅公开课程", "COURSE_PUBLICATION_SUBSCRIPTION_REQUIRED");
  }
  throw error;
}

export const POST = withDynamicAuth<unknown, RouteParams>(
  async (request: NextRequest, { userId, params }) => {
    try {
      const { sectionNodeId } = await parseJsonBodyAs(request, CompletedSectionSchema);
      const target = await getPublicCourseProgressTarget({ slug: params.slug, userId });
      const sectionIndex = target.content.outline.chapters.flatMap((chapter, chapterIndex) =>
        chapter.sections.map((section, sectionIndex) => ({
          chapter,
          section,
          chapterIndex,
          sectionIndex,
        })),
      );
      const completedSection = sectionIndex.find((item) => item.section.nodeId === sectionNodeId);
      if (!completedSection) throw badRequest("课程小节不存在", "SECTION_NOT_FOUND");
      const materializedSection = target.content.sections.find(
        (section) => section.nodeId === sectionNodeId && section.content,
      );
      if (!materializedSection) throw badRequest("课程小节尚未生成", "SECTION_NOT_READY");

      const transition = await completeLearningSection({
        enrollment: {
          userId,
          courseId: target.sourceCourseId,
          sourceType: "publication_snapshot",
          publicationId: target.publicationId,
          snapshotId: target.currentSnapshotId,
        },
        outlineVersionId: target.sourceOutlineVersionId,
        sourceVersionHash: target.snapshotHash,
        courseTitle: target.content.course.title,
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
        allSectionIds: sectionIndex.map((item) => item.section.nodeId),
        activitySource: "publication_reader",
      });

      const completedSet = new Set(transition.completedSectionIds);
      const completedChapters = target.content.outline.chapters.flatMap((chapter, chapterIndex) =>
        chapter.sections.length > 0 &&
        chapter.sections.every((section) => completedSet.has(section.nodeId))
          ? [chapterIndex]
          : [],
      );

      revalidateRecentCourses(userId);
      revalidateProfileStats(userId);
      revalidateCareerTrees(userId);
      return Response.json({
        ok: true,
        alreadyCompleted: !transition.newSectionCompleted,
        completedSections: transition.completedSectionIds,
        completedChapters,
        courseCompleted: transition.courseCompleted,
      });
    } catch (error) {
      handleProgressError(error);
    }
  },
);
