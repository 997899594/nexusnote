import { after, type NextRequest } from "next/server";
import { z } from "zod";
import { notFound, parseJsonBodyAs, withDynamicAuth } from "@/lib/api";
import {
  revalidateCareerTrees,
  revalidateProfileStats,
  revalidateRecentCourses,
} from "@/lib/cache/tags";
import { enqueueCareerTreeRefresh } from "@/lib/career-tree/queue";
import { computeCareerOutlineHash, normalizeCareerOutline } from "@/lib/career-tree/source";
import { ingestEvidenceEvent } from "@/lib/knowledge/events";
import { aggregateCourseEventsToKnowledgeEvidence } from "@/lib/knowledge/evidence/aggregate";
import type { CourseOutline } from "@/lib/learning/course-outline";
import {
  getPublicCourseProgressTarget,
  persistPublicCourseProgress,
} from "@/lib/learning/course-sharing";

interface RouteParams {
  slug: string;
}

interface CourseProgressState {
  currentChapter: number;
  completedChapters: number[];
  completedSections: string[];
  startedAt: Date | null;
  completedAt: Date | null;
}

const CompletedSectionSchema = z.object({
  sectionNodeId: z.string().min(1),
});

const ChapterSchema = z.object({
  currentChapter: z.number().int().min(0),
});

function buildOutlineFromPublicationContent(
  content: Awaited<ReturnType<typeof getPublicCourseProgressTarget>>["content"],
): CourseOutline {
  return {
    title: content.course.title,
    description: content.course.description ?? "",
    targetAudience: content.course.targetAudience ?? "",
    difficulty: (content.course.difficulty ?? "intermediate") as CourseOutline["difficulty"],
    learningOutcome: content.course.learningOutcome ?? "",
    courseSkillIds: [],
    prerequisites: [],
    researchCitations: content.citations.map((citation) => ({
      id: citation.id,
      title: citation.title,
      url: citation.url,
      domain: citation.domain,
      snippet: citation.snippet,
      sourceType: citation.sourceType,
      publishedAt: citation.publishedAt,
    })),
    chapters: content.outline.chapters.map((chapter) => ({
      title: chapter.title,
      description: chapter.description || undefined,
      sections: chapter.sections.map((section) => ({
        title: section.title,
        description: section.description || undefined,
      })),
    })),
  };
}

function buildProgress(existing: CourseProgressState | null): CourseProgressState {
  return {
    currentChapter: existing?.currentChapter ?? 0,
    completedChapters: existing?.completedChapters ?? [],
    completedSections: existing?.completedSections ?? [],
    startedAt: existing?.startedAt ?? new Date(),
    completedAt: existing?.completedAt ?? null,
  };
}

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
      const existing = buildProgress(target.existingProgress);

      if (existing.completedSections.includes(sectionNodeId)) {
        return Response.json({ ok: true, alreadyCompleted: true });
      }

      const completedSections = [...existing.completedSections, sectionNodeId];
      const outline = buildOutlineFromPublicationContent(target.content);
      const normalizedOutline = normalizeCareerOutline(outline);
      const completedChapters = [...existing.completedChapters];

      for (let chapterIndex = 0; chapterIndex < normalizedOutline.chapters.length; chapterIndex++) {
        if (completedChapters.includes(chapterIndex)) {
          continue;
        }

        const chapter = normalizedOutline.chapters[chapterIndex];
        const allDone =
          chapter.sections.length > 0 &&
          chapter.sections.every((section) => completedSections.includes(section.sectionKey));

        if (allDone) {
          completedChapters.push(chapterIndex);
        }
      }

      const allChaptersDone =
        normalizedOutline.chapters.length > 0 &&
        completedChapters.length >= normalizedOutline.chapters.length;
      const completedAt = allChaptersDone
        ? (existing.completedAt ?? new Date())
        : existing.completedAt;

      const progress: CourseProgressState = {
        currentChapter: existing.currentChapter,
        completedChapters,
        completedSections,
        startedAt: existing.startedAt,
        completedAt,
      };

      await persistPublicCourseProgress({
        publicationId: target.publicationId,
        userId,
        progress,
        existingRecordId: target.existingProgress?.id,
      });

      const outlineHash = computeCareerOutlineHash(normalizedOutline);
      const completedSection = normalizedOutline.chapters
        .flatMap((chapter) =>
          chapter.sections.map((section) => ({
            chapter,
            section,
          })),
        )
        .find((item) => item.section.sectionKey === sectionNodeId);

      after(async () => {
        try {
          await ingestEvidenceEvent({
            id: crypto.randomUUID(),
            userId,
            kind: "course_progress",
            sourceType: "course",
            sourceId: target.sourceCourseId,
            sourceVersionHash: outlineHash,
            title: target.content.course.title,
            summary: completedSection
              ? `完成了《${completedSection.section.title}》`
              : `完成了 ${sectionNodeId}`,
            confidence: 1,
            happenedAt: new Date().toISOString(),
            metadata: {
              publicationId: target.publicationId,
              sectionNodeId,
              completedSectionCount: completedSections.length,
              completedChapterCount: completedChapters.length,
            },
            refs: [
              {
                refType: "section",
                refId: sectionNodeId,
                snippet: completedSection?.section.title ?? null,
                weight: 1,
              },
              ...(completedSection
                ? [
                    {
                      refType: "chapter",
                      refId: completedSection.chapter.chapterKey,
                      snippet: completedSection.chapter.title,
                      weight: 1,
                    },
                  ]
                : []),
            ],
          });

          await aggregateCourseEventsToKnowledgeEvidence({
            userId,
            courseId: target.sourceCourseId,
            sourceVersionHash: outlineHash,
          });

          await enqueueCareerTreeRefresh({
            userId,
            courseId: target.sourceCourseId,
            reasonKey: `public-course-progress:${target.publicationId}:${completedSections.length}:${completedChapters.length}:${sectionNodeId}`,
          });

          revalidateRecentCourses(userId);
          revalidateProfileStats(userId);
          revalidateCareerTrees(userId);
        } catch (error) {
          console.error(
            "[PublicCourseProgress] Failed to sync progress knowledge pipeline:",
            error,
          );
        }
      });

      return Response.json({
        ok: true,
        completedSections,
        completedChapters,
        courseCompleted: allChaptersDone,
      });
    } catch (error) {
      handleProgressError(error);
    }
  },
);

export const PATCH = withDynamicAuth<unknown, RouteParams>(
  async (request: NextRequest, { userId, params }) => {
    try {
      const { currentChapter } = await parseJsonBodyAs(request, ChapterSchema);
      const target = await getPublicCourseProgressTarget({ slug: params.slug, userId });
      const existing = buildProgress(target.existingProgress);

      await persistPublicCourseProgress({
        publicationId: target.publicationId,
        userId,
        progress: {
          ...existing,
          currentChapter,
        },
        existingRecordId: target.existingProgress?.id,
      });

      revalidateRecentCourses(userId);
      revalidateProfileStats(userId);

      return Response.json({ ok: true });
    } catch (error) {
      handleProgressError(error);
    }
  },
);
