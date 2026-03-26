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

function buildOutlineDescription(title: string) {
  return `围绕 ${title} 的系统学习路径，帮助你逐步建立关键知识和实践能力。`;
}

function buildTargetAudience(title: string) {
  return `希望系统学习 ${title} 并形成可展示成果的学习者。`;
}

function buildLearningOutcome(title: string) {
  return `完成 ${title} 的系统学习，并产出可展示的实践成果。`;
}

function buildChapterDescription(title: string) {
  return `围绕 ${title} 建立关键理解与实践能力。`;
}

function buildSectionDescription(title: string) {
  return `学习 ${title} 的核心概念、方法和应用方式。`;
}

export function expandInterviewOutlineToCourseOutline(outline: InterviewOutline): CourseOutline {
  return {
    title: outline.title,
    description: buildOutlineDescription(outline.title),
    targetAudience: buildTargetAudience(outline.title),
    prerequisites: undefined,
    difficulty: outline.difficulty,
    learningOutcome: buildLearningOutcome(outline.title),
    chapters: outline.chapters.map((chapter) => ({
      title: chapter.title,
      description: buildChapterDescription(chapter.title),
      practiceType: chapter.practiceType,
      sections: chapter.sections.map((section) => ({
        title: section.title,
        description: buildSectionDescription(section.title),
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
