import { generateObject } from "ai";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { courseProgress, courseSections, courses, db } from "@/db";
import { getJsonModelForPolicy } from "@/lib/ai/core/model-policy";
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

const CourseOutlineSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().min(1).max(300),
  targetAudience: z.string().min(1).max(200),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]),
  learningOutcome: z.string().min(1).max(240),
  prerequisites: z.array(z.string().min(1).max(120)).max(8).optional(),
  chapters: z
    .array(
      z.object({
        title: z.string().min(1).max(120),
        description: z.string().min(1).max(220),
        practiceType: z.enum(["exercise", "project", "quiz", "none"]).optional(),
        sections: z
          .array(
            z.object({
              title: z.string().min(1).max(100),
              description: z.string().min(1).max(180),
            }),
          )
          .min(4)
          .max(6),
      }),
    )
    .min(5)
    .max(7),
});

function buildHeuristicCourseOutline(outline: InterviewOutline): CourseOutline {
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

export async function expandInterviewOutlineToCourseOutline(
  outline: InterviewOutline,
): Promise<CourseOutline> {
  const previewSummary = outline.chapters
    .map((chapter, chapterIndex) => {
      const sectionTitles = chapter.sections.map((section) => section.title).join("、");
      return `${chapterIndex + 1}. ${chapter.title}: ${sectionTitles}`;
    })
    .join("\n");

  try {
    const result = await generateObject({
      model: getJsonModelForPolicy("structured-high-quality"),
      schema: CourseOutlineSchema,
      system: `你是 NexusNote 的课程架构师。

你的任务是把轻量课程草案扩写成一门真正可学习的课程大纲。

必须遵守：
- 保持原始课程方向，不要偏题
- 默认生成大约 6 章课程；允许根据主题宽度收缩到 5 章或扩展到 7 章
- 每章至少 4 个小节，最多 6 个小节
- 整体结构要完整、均衡，前期打基础，中期建立核心能力，后期做综合应用与实践
- 至少保留一个明显的实战/项目导向章节
- 标题简洁具体，description 要说明这一章/小节学什么以及为什么重要
- 输出的是“正式课程大纲”，不是访谈预览`,
      prompt: `请把下面的轻量草案扩写成正式课程大纲。

课程标题：${outline.title}
难度：${outline.difficulty}

当前草案：
${previewSummary}

要求：
- 课程通常按 6 章左右组织
- 每章 4 个小节起
- 内容要丰富，但不能堆砌重复章节
- 要让学习者真正能从入门走到能做出成果
- 如果草案已有项目/作品集方向，正式课程里必须保留并加强这条主线`,
      temperature: 0.4,
    });

    return result.object;
  } catch (error) {
    console.error("[CourseService] AI course expansion failed, falling back to heuristic:", error);
    return buildHeuristicCourseOutline(outline);
  }
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
