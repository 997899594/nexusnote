import { and, eq } from "drizzle-orm";
import { courseProgress, courseSections, courses, db } from "@/db";
import type { InterviewOutline } from "@/lib/ai/interview";

export interface CourseOutlineSection {
  title: string;
  description: string;
}

export interface CourseOutlineChapter {
  title: string;
  description: string;
  sections: CourseOutlineSection[];
  practiceType?: "exercise" | "project" | "quiz" | "none";
}

export interface CourseOutline {
  title: string;
  description: string;
  targetAudience: string;
  prerequisites?: string[];
  difficulty: "beginner" | "intermediate" | "advanced";
  chapters: CourseOutlineChapter[];
  learningOutcome: string;
}

export async function expandInterviewOutlineToCourseOutline(
  outline: InterviewOutline,
): Promise<CourseOutline> {
  return {
    title: outline.title,
    description: outline.description,
    targetAudience: outline.targetAudience,
    prerequisites: undefined,
    difficulty: outline.difficulty,
    learningOutcome: outline.learningOutcome,
    chapters: outline.chapters.map((chapter) => ({
      title: chapter.title,
      description: chapter.description,
      practiceType: chapter.practiceType,
      sections: chapter.sections.map((section) => ({
        title: section.title,
        description: section.description,
      })),
    })),
  };
}

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
      outlineData: outline,
      updatedAt: new Date(),
    };

    let persistedCourseId = courseId;

    if (persistedCourseId) {
      const [existingCourse] = await tx
        .select({ id: courses.id })
        .from(courses)
        .where(and(eq(courses.id, persistedCourseId), eq(courses.userId, userId)))
        .limit(1);

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

    await tx.delete(courseSections).where(eq(courseSections.courseId, persistedCourseId));

    const sectionDocuments = outline.chapters.flatMap((chapter, chapterIndex) =>
      chapter.sections.map((section, sectionIndex) => ({
        title: section.title,
        courseId: persistedCourseId,
        outlineNodeId: `section-${chapterIndex + 1}-${sectionIndex + 1}`,
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
