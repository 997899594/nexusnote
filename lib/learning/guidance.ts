import { getUserGrowthContext, type UserGrowthContext } from "@/lib/growth/generation-context";
import {
  buildLearningAlignmentBrief,
  formatLearningAlignmentBrief,
  type LearningAlignmentBrief,
} from "@/lib/learning/alignment";
import { getOwnedCourseWithOutline } from "@/lib/learning/course-repository";
import { createLearnTrace } from "@/lib/learning/observability";

type OwnedCourseWithOutline = NonNullable<Awaited<ReturnType<typeof getOwnedCourseWithOutline>>>;

export interface LearningGuidanceSection {
  index: number;
  title: string;
  description: string;
  alignment: LearningAlignmentBrief;
}

export interface LearningGuidance {
  course: {
    id: string;
    title: string;
    description: string;
    targetAudience: string;
    difficulty: string;
    learningOutcome: string | null;
    skillIds: string[];
    totalChapters: number;
  };
  chapter: {
    index: number;
    title: string;
    description: string;
    skillIds: string[];
    alignment: LearningAlignmentBrief;
    sections: LearningGuidanceSection[];
  };
  growth: UserGrowthContext;
}

function resolveCourseTitle(course: OwnedCourseWithOutline) {
  return course.title?.trim() || course.outline.title?.trim() || "Untitled Course";
}

export function buildLearningGuidance(input: {
  course: OwnedCourseWithOutline;
  chapterIndex: number;
  growth: UserGrowthContext;
}): LearningGuidance | null {
  const chapter = input.course.outline.chapters[input.chapterIndex];

  if (!chapter) {
    return null;
  }

  const courseTitle = resolveCourseTitle(input.course);
  const courseDescription = input.course.outline.description ?? "";
  const courseSkillIds = input.course.outline.courseSkillIds ?? [];
  const chapterTitle = chapter.title?.trim() || `第 ${input.chapterIndex + 1} 章`;
  const chapterDescription = chapter.description?.trim() || "";
  const chapterSkillIds = chapter.skillIds ?? [];

  const chapterAlignment = buildLearningAlignmentBrief({
    chapterTitle,
    chapterDescription,
    chapterSkillIds,
    courseSkillIds,
    generationContext: input.growth,
  });

  const sections: LearningGuidanceSection[] = (chapter.sections ?? []).map(
    (section, sectionIndex) => ({
      index: sectionIndex,
      title: section.title.trim(),
      description: section.description ?? "",
      alignment: buildLearningAlignmentBrief({
        chapterTitle,
        chapterDescription,
        chapterSkillIds,
        courseSkillIds,
        sectionTitle: section.title,
        sectionDescription: section.description,
        generationContext: input.growth,
      }),
    }),
  );

  return {
    course: {
      id: input.course.id,
      title: courseTitle,
      description: courseDescription,
      targetAudience: input.course.outline.targetAudience ?? "",
      difficulty: input.course.difficulty ?? "beginner",
      learningOutcome: input.course.outline.learningOutcome ?? null,
      skillIds: courseSkillIds,
      totalChapters: input.course.outline.chapters.length,
    },
    chapter: {
      index: input.chapterIndex,
      title: chapterTitle,
      description: chapterDescription,
      skillIds: chapterSkillIds,
      alignment: chapterAlignment,
      sections,
    },
    growth: input.growth,
  };
}

export async function getLearningGuidance(params: {
  userId: string;
  courseId: string;
  chapterIndex: number;
  traceId?: string;
}): Promise<LearningGuidance | null> {
  const trace = createLearnTrace(
    "resolve-guidance",
    {
      userId: params.userId,
      courseId: params.courseId,
      chapterIndex: params.chapterIndex,
    },
    params.traceId,
  );

  const [course, growth] = await Promise.all([
    getOwnedCourseWithOutline(params.courseId, params.userId),
    getUserGrowthContext(params.userId),
  ]);

  if (!course) {
    trace.finish({
      found: false,
      reason: "course-not-found",
    });
    return null;
  }

  const guidance = buildLearningGuidance({
    course,
    chapterIndex: params.chapterIndex,
    growth,
  });

  if (!guidance) {
    trace.finish({
      found: false,
      reason: "chapter-not-found",
    });
    return null;
  }

  trace.finish({
    found: true,
    courseTitle: guidance.course.title,
    chapterTitle: guidance.chapter.title,
    courseSkillCount: guidance.course.skillIds.length,
    chapterSkillCount: guidance.chapter.skillIds.length,
    sectionCount: guidance.chapter.sections.length,
    alignmentRelation: guidance.chapter.alignment.relation,
  });

  return guidance;
}

function formatSkillIds(skillIds: string[]) {
  return skillIds.length > 0 ? skillIds.join("、") : "";
}

export function formatLearningGuidancePromptContext(guidance: LearningGuidance): string {
  const lines = [
    "## 当前学习上下文",
    `课程：${guidance.course.title}`,
    `当前章节：第 ${guidance.chapter.index + 1} 章 - ${guidance.chapter.title}`,
    guidance.chapter.description ? `章节描述：${guidance.chapter.description}` : "",
    guidance.chapter.skillIds.length > 0
      ? `本章能力目标：${formatSkillIds(guidance.chapter.skillIds)}`
      : "",
    guidance.course.skillIds.length > 0
      ? `课程核心能力：${formatSkillIds(guidance.course.skillIds)}`
      : "",
    guidance.chapter.sections.length > 0
      ? `小节：${guidance.chapter.sections.map((section) => section.title).join("、")}`
      : "",
    "提示：使用 loadLearnContext 工具获取章节详细内容后再回答问题。",
    "",
    "## 当前学习对齐简报",
    formatLearningAlignmentBrief(guidance.chapter.alignment, "prompt"),
  ];

  return lines.filter(Boolean).join("\n");
}
