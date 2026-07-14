import "server-only";

import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import {
  courseOutlineNodes,
  courseOutlineVersions,
  coursePublicationSnapshots,
  coursePublicationSubscriptions,
  coursePublications,
  courses,
  db,
  learningActivityEvents,
  learningEnrollments,
  learningSectionCompletions,
} from "@/db";
import { getRecentCoursesTag } from "@/lib/cache/tags";
import {
  type LearningMomentumProjection,
  type LearningMomentumSection,
  projectLearningMomentum,
} from "@/lib/learning/momentum";

export interface RecentLearningItem extends LearningMomentumProjection {
  id: string;
  sourceKind: "course" | "publication";
  title: string;
  description: string | null;
  url: string;
  lastActivityAt: Date | null;
  timeLabel: string;
  nextSectionTitle: string | null;
}

interface PrivateCourseRow {
  id: string;
  title: string;
  description: string | null;
  estimatedMinutes: number | null;
  courseUpdatedAt: Date | null;
  enrollmentId: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  progressUpdatedAt: Date | null;
}

function formatTime(date: Date | null): string {
  if (!date) return "";
  return date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
}

function normalizeTimestamp(value: Date | string | null): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toItem(input: {
  id: string;
  sourceKind: RecentLearningItem["sourceKind"];
  title: string;
  description: string | null;
  urlBase: string;
  sections: LearningMomentumSection[];
  completedSections: string[] | null;
  startedAt: Date | null;
  completedAt: Date | null;
  estimatedMinutes: number | null;
  lastActivityAt: Date | null;
}): RecentLearningItem {
  const momentum = projectLearningMomentum({
    sections: input.sections,
    completedSections: input.completedSections,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    estimatedMinutes: input.estimatedMinutes,
  });
  const chapterQuery = momentum.nextSection
    ? `?chapter=${momentum.nextSection.chapterIndex + 1}`
    : "";

  return {
    ...momentum,
    id: input.id,
    sourceKind: input.sourceKind,
    title: input.title,
    description: input.description,
    url: `${input.urlBase}${chapterQuery}`,
    lastActivityAt: input.lastActivityAt,
    timeLabel: formatTime(input.lastActivityAt),
    nextSectionTitle: momentum.nextSection?.title ?? null,
  };
}

async function loadPrivateItems(userId: string): Promise<RecentLearningItem[]> {
  const courseRows: PrivateCourseRow[] = await db
    .select({
      id: courses.id,
      title: courses.title,
      description: courses.description,
      estimatedMinutes: courses.estimatedMinutes,
      courseUpdatedAt: courses.updatedAt,
      enrollmentId: learningEnrollments.id,
      startedAt: learningEnrollments.startedAt,
      completedAt: learningEnrollments.completedAt,
      progressUpdatedAt: learningEnrollments.updatedAt,
    })
    .from(courses)
    .innerJoin(
      courseOutlineVersions,
      and(eq(courseOutlineVersions.courseId, courses.id), eq(courseOutlineVersions.isLatest, true)),
    )
    .leftJoin(
      learningEnrollments,
      and(
        eq(learningEnrollments.outlineVersionId, courseOutlineVersions.id),
        eq(learningEnrollments.userId, userId),
      ),
    )
    .where(eq(courses.userId, userId))
    .orderBy(desc(sql`coalesce(${learningEnrollments.updatedAt}, ${courses.updatedAt})`))
    .limit(50);

  if (courseRows.length === 0) return [];

  const courseIds = courseRows.map((course) => course.id);
  const enrollmentIds = courseRows.flatMap((course) =>
    course.enrollmentId ? [course.enrollmentId] : [],
  );
  const [sectionRows, activityRows, completionRows] = await Promise.all([
    db
      .select({
        courseId: courseOutlineNodes.courseId,
        nodeId: courseOutlineNodes.semanticId,
        title: courseOutlineNodes.title,
        chapterIndex: courseOutlineNodes.chapterIndex,
        sectionIndex: courseOutlineNodes.sectionIndex,
      })
      .from(courseOutlineNodes)
      .innerJoin(
        courseOutlineVersions,
        and(
          eq(courseOutlineNodes.outlineVersionId, courseOutlineVersions.id),
          eq(courseOutlineVersions.isLatest, true),
        ),
      )
      .where(
        and(
          inArray(courseOutlineNodes.courseId, courseIds),
          eq(courseOutlineNodes.nodeType, "section"),
        ),
      ),
    db
      .select({
        enrollmentId: learningActivityEvents.enrollmentId,
        lastActivityAt: sql<string | null>`max(${learningActivityEvents.occurredAt})`,
      })
      .from(learningActivityEvents)
      .where(
        enrollmentIds.length > 0
          ? and(
              eq(learningActivityEvents.userId, userId),
              inArray(learningActivityEvents.enrollmentId, enrollmentIds),
            )
          : sql`false`,
      )
      .groupBy(learningActivityEvents.enrollmentId),
    enrollmentIds.length > 0
      ? db
          .select({
            enrollmentId: learningSectionCompletions.enrollmentId,
            sectionId: learningSectionCompletions.sectionId,
          })
          .from(learningSectionCompletions)
          .where(inArray(learningSectionCompletions.enrollmentId, enrollmentIds))
      : Promise.resolve([]),
  ]);

  const sectionsByCourse = new Map<string, LearningMomentumSection[]>();
  for (const section of sectionRows) {
    if (section.sectionIndex === null) continue;
    const sections = sectionsByCourse.get(section.courseId) ?? [];
    sections.push({
      nodeId: section.nodeId,
      title: section.title,
      chapterIndex: section.chapterIndex,
      sectionIndex: section.sectionIndex,
    });
    sectionsByCourse.set(section.courseId, sections);
  }
  for (const sections of sectionsByCourse.values()) {
    sections.sort(
      (left, right) =>
        left.chapterIndex - right.chapterIndex || left.sectionIndex - right.sectionIndex,
    );
  }

  const activityByEnrollment = new Map(
    activityRows.map((activity) => [
      activity.enrollmentId,
      normalizeTimestamp(activity.lastActivityAt),
    ]),
  );
  const completionsByEnrollment = new Map<string, string[]>();
  for (const completion of completionRows) {
    const sectionIds = completionsByEnrollment.get(completion.enrollmentId) ?? [];
    sectionIds.push(completion.sectionId);
    completionsByEnrollment.set(completion.enrollmentId, sectionIds);
  }

  return courseRows.map((course) =>
    toItem({
      id: course.id,
      sourceKind: "course",
      title: course.title,
      description: course.description,
      urlBase: `/learn/${course.id}`,
      sections: sectionsByCourse.get(course.id) ?? [],
      completedSections: course.enrollmentId
        ? (completionsByEnrollment.get(course.enrollmentId) ?? [])
        : [],
      startedAt: course.startedAt,
      completedAt: course.completedAt,
      estimatedMinutes: course.estimatedMinutes,
      lastActivityAt:
        (course.enrollmentId ? activityByEnrollment.get(course.enrollmentId) : null) ??
        course.progressUpdatedAt ??
        course.courseUpdatedAt,
    }),
  );
}

async function loadPublicationItems(userId: string): Promise<RecentLearningItem[]> {
  const rows = await db
    .select({
      publicationId: coursePublications.id,
      slug: coursePublications.slug,
      title: coursePublications.title,
      description: coursePublications.description,
      publishedAt: coursePublications.publishedAt,
      subscriptionUpdatedAt: coursePublicationSubscriptions.updatedAt,
      snapshot: coursePublicationSnapshots.contentJson,
      enrollmentId: learningEnrollments.id,
      startedAt: learningEnrollments.startedAt,
      completedAt: learningEnrollments.completedAt,
      progressUpdatedAt: learningEnrollments.updatedAt,
    })
    .from(coursePublicationSubscriptions)
    .innerJoin(
      coursePublications,
      eq(coursePublicationSubscriptions.publicationId, coursePublications.id),
    )
    .innerJoin(
      coursePublicationSnapshots,
      eq(coursePublications.currentSnapshotId, coursePublicationSnapshots.id),
    )
    .leftJoin(
      learningEnrollments,
      and(
        eq(learningEnrollments.snapshotId, coursePublicationSnapshots.id),
        eq(learningEnrollments.userId, userId),
      ),
    )
    .where(eq(coursePublicationSubscriptions.userId, userId))
    .limit(50);

  const enrollmentIds = rows.flatMap((row) => (row.enrollmentId ? [row.enrollmentId] : []));
  const completionRows =
    enrollmentIds.length > 0
      ? await db
          .select({
            enrollmentId: learningSectionCompletions.enrollmentId,
            sectionId: learningSectionCompletions.sectionId,
          })
          .from(learningSectionCompletions)
          .where(inArray(learningSectionCompletions.enrollmentId, enrollmentIds))
      : [];
  const completionsByEnrollment = new Map<string, string[]>();
  for (const completion of completionRows) {
    const sectionIds = completionsByEnrollment.get(completion.enrollmentId) ?? [];
    sectionIds.push(completion.sectionId);
    completionsByEnrollment.set(completion.enrollmentId, sectionIds);
  }

  return rows.map((row) =>
    toItem({
      id: `public:${row.publicationId}`,
      sourceKind: "publication",
      title: row.title,
      description: row.description,
      urlBase: `/c/${row.slug}/learn`,
      sections: row.snapshot.outline.chapters.flatMap((chapter, chapterIndex) =>
        chapter.sections.map((section, sectionIndex) => ({
          nodeId: section.nodeId,
          title: section.title,
          chapterIndex,
          sectionIndex,
        })),
      ),
      completedSections: row.enrollmentId
        ? (completionsByEnrollment.get(row.enrollmentId) ?? [])
        : [],
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      estimatedMinutes: row.snapshot.course.estimatedMinutes,
      lastActivityAt: row.progressUpdatedAt ?? row.subscriptionUpdatedAt ?? row.publishedAt,
    }),
  );
}

function momentumPriority(item: RecentLearningItem): number {
  if (item.status === "in_progress") return 0;
  if (item.status === "not_started") return 1;
  return 2;
}

export async function getRecentLearningItemsCached(
  userId: string,
  limit = 6,
): Promise<RecentLearningItem[]> {
  "use cache";

  cacheLife("minutes");
  cacheTag(getRecentCoursesTag(userId));

  const [privateItems, publicationItems] = await Promise.all([
    loadPrivateItems(userId),
    loadPublicationItems(userId),
  ]);

  return [...privateItems, ...publicationItems]
    .sort(
      (left, right) =>
        momentumPriority(left) - momentumPriority(right) ||
        (right.lastActivityAt?.getTime() ?? 0) - (left.lastActivityAt?.getTime() ?? 0),
    )
    .slice(0, limit);
}
