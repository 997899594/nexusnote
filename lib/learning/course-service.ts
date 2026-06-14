import { and, eq } from "drizzle-orm";
import {
  courseOutlineNodes,
  courseOutlineVersions,
  courseProgress,
  courseSections,
  courses,
  db,
} from "@/db";
import { getOwnedCourse } from "@/lib/learning/course-repository";
import {
  refreshPublishedCoursePublication,
  revalidateCoursePublicationRefresh,
} from "@/lib/learning/course-sharing";
import {
  buildCourseOutlineNodeValues,
  buildCourseOutlineVersionValues,
  computeCourseOutlineVersionHash,
} from "@/lib/learning/course-structure";
import { buildSectionOutlineNodeKey } from "@/lib/learning/outline-node-key";
import type { CourseOutline } from "./course-outline";

interface SaveCourseFromOutlineOptions {
  userId: string;
  outline: CourseOutline;
  courseId?: string;
}

type CourseSaveTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

function estimateCourseMinutes(outline: CourseOutline) {
  const sectionCount = outline.chapters.reduce(
    (total, chapter) => total + chapter.sections.length,
    0,
  );
  const baseMinutes = Math.max(sectionCount, 1) * 45;
  const projectBonus = outline.chapters.some((chapter) => chapter.practiceType === "project")
    ? 90
    : 0;
  return baseMinutes + projectBonus;
}

function buildInitialProgress(_outline: CourseOutline) {
  return {
    currentChapter: 0,
    completedChapters: [] as number[],
    completedSections: [] as string[],
    startedAt: new Date(),
    completedAt: null,
    updatedAt: new Date(),
  };
}

function buildSectionDocuments(courseId: string, outline: CourseOutline) {
  return outline.chapters.flatMap((chapter, chapterIndex) =>
    chapter.sections.map((section, sectionIndex) => ({
      title: section.title,
      courseId,
      outlineNodeKey: buildSectionOutlineNodeKey(chapterIndex, sectionIndex),
      contentMarkdown: null,
      plainText: null,
    })),
  );
}

async function replaceCourseStructureFromOutline(params: {
  tx: CourseSaveTransaction;
  userId: string;
  courseId: string;
  outlineVersionId: string;
  outline: CourseOutline;
}) {
  const { tx, userId, courseId, outlineVersionId, outline } = params;

  await tx
    .delete(courseOutlineNodes)
    .where(eq(courseOutlineNodes.outlineVersionId, outlineVersionId));

  const outlineNodes = buildCourseOutlineNodeValues({
    courseId,
    outlineVersionId,
    outline,
  });

  if (outlineNodes.length > 0) {
    await tx.insert(courseOutlineNodes).values(outlineNodes);
  }

  await tx.delete(courseSections).where(eq(courseSections.courseId, courseId));

  const sectionDocuments = buildSectionDocuments(courseId, outline);

  if (sectionDocuments.length > 0) {
    await tx.insert(courseSections).values(sectionDocuments);
  }

  const progressValues = {
    courseId,
    userId,
    ...buildInitialProgress(outline),
  };

  const [existingProgress] = await tx
    .select({ id: courseProgress.id })
    .from(courseProgress)
    .where(eq(courseProgress.courseId, courseId))
    .limit(1);

  if (existingProgress) {
    await tx
      .update(courseProgress)
      .set(progressValues)
      .where(eq(courseProgress.courseId, courseId));
  } else {
    await tx.insert(courseProgress).values(progressValues);
  }
}

export async function saveCourseFromOutline({
  userId,
  outline,
  courseId,
}: SaveCourseFromOutlineOptions): Promise<{ courseId: string }> {
  const result = await db.transaction(async (tx) => {
    const now = new Date();
    const outlineVersionHash = computeCourseOutlineVersionHash(outline);
    const courseValues = {
      userId,
      title: outline.title,
      description: outline.description ?? null,
      difficulty: outline.difficulty,
      estimatedMinutes: estimateCourseMinutes(outline),
      updatedAt: now,
    };

    let persistedCourseId = courseId;

    if (persistedCourseId) {
      const existingCourse = await getOwnedCourse(persistedCourseId, userId, tx);
      if (!existingCourse) {
        throw new Error("课程不存在或无权访问");
      }

      await tx.update(courses).set(courseValues).where(eq(courses.id, persistedCourseId));
    } else {
      const [createdCourse] = await tx
        .insert(courses)
        .values(courseValues)
        .returning({ id: courses.id });

      persistedCourseId = createdCourse.id;
    }

    const [existingOutlineVersion] = await tx
      .select({ id: courseOutlineVersions.id, isLatest: courseOutlineVersions.isLatest })
      .from(courseOutlineVersions)
      .where(
        and(
          eq(courseOutlineVersions.courseId, persistedCourseId),
          eq(courseOutlineVersions.versionHash, outlineVersionHash),
        ),
      )
      .limit(1);

    if (existingOutlineVersion) {
      if (!existingOutlineVersion.isLatest) {
        await tx
          .update(courseOutlineVersions)
          .set({ isLatest: false, updatedAt: now })
          .where(eq(courseOutlineVersions.courseId, persistedCourseId));

        await tx
          .update(courseOutlineVersions)
          .set({ isLatest: true, updatedAt: now })
          .where(eq(courseOutlineVersions.id, existingOutlineVersion.id));

        await replaceCourseStructureFromOutline({
          tx,
          userId,
          courseId: persistedCourseId,
          outlineVersionId: existingOutlineVersion.id,
          outline,
        });
      }

      const publicationRefresh = await refreshPublishedCoursePublication({
        courseId: persistedCourseId,
        userId,
        executor: tx,
        revalidate: false,
      });

      return { courseId: persistedCourseId, publicationRefresh };
    }

    await tx
      .update(courseOutlineVersions)
      .set({ isLatest: false, updatedAt: now })
      .where(eq(courseOutlineVersions.courseId, persistedCourseId));

    const [outlineVersion] = await tx
      .insert(courseOutlineVersions)
      .values(
        buildCourseOutlineVersionValues({
          courseId: persistedCourseId,
          outline,
          versionHash: outlineVersionHash,
          updatedAt: now,
        }),
      )
      .onConflictDoNothing({
        target: [courseOutlineVersions.courseId, courseOutlineVersions.versionHash],
      })
      .returning({ id: courseOutlineVersions.id });

    if (!outlineVersion) {
      const [racedOutlineVersion] = await tx
        .select({ id: courseOutlineVersions.id, isLatest: courseOutlineVersions.isLatest })
        .from(courseOutlineVersions)
        .where(
          and(
            eq(courseOutlineVersions.courseId, persistedCourseId),
            eq(courseOutlineVersions.versionHash, outlineVersionHash),
          ),
        )
        .limit(1);

      if (!racedOutlineVersion) {
        throw new Error("Course outline version conflict without persisted row");
      }

      if (!racedOutlineVersion.isLatest) {
        await tx
          .update(courseOutlineVersions)
          .set({ isLatest: true, updatedAt: now })
          .where(eq(courseOutlineVersions.id, racedOutlineVersion.id));
      }

      const publicationRefresh = await refreshPublishedCoursePublication({
        courseId: persistedCourseId,
        userId,
        executor: tx,
        revalidate: false,
      });

      return { courseId: persistedCourseId, publicationRefresh };
    }

    await replaceCourseStructureFromOutline({
      tx,
      userId,
      courseId: persistedCourseId,
      outlineVersionId: outlineVersion.id,
      outline,
    });

    const publicationRefresh = await refreshPublishedCoursePublication({
      courseId: persistedCourseId,
      userId,
      executor: tx,
      revalidate: false,
    });

    return { courseId: persistedCourseId, publicationRefresh };
  });

  revalidateCoursePublicationRefresh(result.publicationRefresh);

  return { courseId: result.courseId };
}
