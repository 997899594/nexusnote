import { eq } from "drizzle-orm";
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
  buildCourseOutlineNodeValues,
  buildCourseOutlineVersionValues,
} from "@/lib/learning/course-structure";
import type { CourseOutline } from "./course-outline";

interface SaveCourseFromOutlineOptions {
  userId: string;
  outline: CourseOutline;
  courseId?: string;
}

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

export async function saveCourseFromOutline({
  userId,
  outline,
  courseId,
}: SaveCourseFromOutlineOptions): Promise<{ courseId: string }> {
  return db.transaction(async (tx) => {
    const courseValues = {
      userId,
      title: outline.title,
      description: outline.description,
      difficulty: outline.difficulty,
      estimatedMinutes: estimateCourseMinutes(outline),
      updatedAt: new Date(),
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

    await tx
      .update(courseOutlineVersions)
      .set({ isLatest: false, updatedAt: new Date() })
      .where(eq(courseOutlineVersions.courseId, persistedCourseId));

    const [outlineVersion] = await tx
      .insert(courseOutlineVersions)
      .values(buildCourseOutlineVersionValues({ courseId: persistedCourseId, outline }))
      .returning({ id: courseOutlineVersions.id });

    await tx
      .delete(courseOutlineNodes)
      .where(eq(courseOutlineNodes.outlineVersionId, outlineVersion.id));

    await tx.insert(courseOutlineNodes).values(
      buildCourseOutlineNodeValues({
        courseId: persistedCourseId,
        outlineVersionId: outlineVersion.id,
        outline,
      }),
    );

    await tx.delete(courseSections).where(eq(courseSections.courseId, persistedCourseId));

    const sectionDocuments = outline.chapters.flatMap((chapter, chapterIndex) =>
      chapter.sections.map((section, sectionIndex) => ({
        title: section.title,
        courseId: persistedCourseId,
        outlineNodeKey: `section-${chapterIndex + 1}-${sectionIndex + 1}`,
        contentMarkdown: null,
        plainText: null,
      })),
    );

    if (sectionDocuments.length > 0) {
      await tx.insert(courseSections).values(sectionDocuments);
    }
    const progressValues = {
      courseId: persistedCourseId,
      userId,
      ...buildInitialProgress(outline),
    };

    const [existingProgress] = await tx
      .select({ id: courseProgress.id })
      .from(courseProgress)
      .where(eq(courseProgress.courseId, persistedCourseId))
      .limit(1);

    if (existingProgress) {
      await tx
        .update(courseProgress)
        .set(progressValues)
        .where(eq(courseProgress.courseId, persistedCourseId));
    } else {
      await tx.insert(courseProgress).values(progressValues);
    }

    return { courseId: persistedCourseId };
  });
}
