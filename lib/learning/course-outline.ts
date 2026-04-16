import { generateText, Output } from "ai";
import { z } from "zod";
import { aiProvider, type InterviewOutline, InterviewOutlineSchema } from "@/lib/ai";
import { getJsonModelForPolicy } from "@/lib/ai/core/model-policy";
import { createTelemetryContext, getErrorMessage, recordAIUsage } from "@/lib/ai/core/telemetry";
import { loadPromptResource } from "@/lib/ai/prompts/load-prompt";
import { APIError } from "@/lib/api";
import {
  formatGrowthGenerationContext,
  type GrowthGenerationContext,
} from "@/lib/growth/generation-context-format";
import {
  buildCourseBlueprintAlignmentBrief,
  type CourseBlueprintAlignmentBrief,
  formatCourseBlueprintAlignmentBrief,
} from "@/lib/learning/alignment";

const COURSE_BLUEPRINT_REFINER_PROMPT = loadPromptResource("growth/course-blueprint.md");

const CoursePrerequisiteSchema = z.string().trim().min(1).max(120);

export const CourseOutlineSectionSchema = z.object({
  title: z.string().min(1).max(80),
  description: z.string().min(1).max(180),
});

export const CourseOutlineChapterSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().min(1).max(220),
  sections: z.array(CourseOutlineSectionSchema).min(4).max(6),
  practiceType: z.enum(["exercise", "project", "quiz", "none"]).optional(),
  skillIds: z.array(z.string().trim().min(1).max(80)).min(1).max(4).optional(),
});

export const CourseOutlineSchema = InterviewOutlineSchema.extend({
  prerequisites: z.array(CoursePrerequisiteSchema).max(8).optional(),
  chapters: z.array(CourseOutlineChapterSchema).min(5).max(7),
});

export type CourseOutlineSection = z.infer<typeof CourseOutlineSectionSchema>;
export type CourseOutlineChapter = z.infer<typeof CourseOutlineChapterSchema>;
export type CourseOutline = z.infer<typeof CourseOutlineSchema>;

interface ExpandInterviewOutlineToCourseOutlineOptions {
  userId: string;
  outline: InterviewOutline;
  generationContext?: GrowthGenerationContext;
  courseId?: string;
}

function mapInterviewOutlineToCourseOutline(outline: InterviewOutline): CourseOutline {
  return {
    title: outline.title,
    description: outline.description,
    targetAudience: outline.targetAudience,
    prerequisites: undefined,
    difficulty: outline.difficulty,
    courseSkillIds: outline.courseSkillIds,
    learningOutcome: outline.learningOutcome,
    chapters: outline.chapters.map((chapter) => ({
      title: chapter.title,
      description: chapter.description,
      practiceType: chapter.practiceType,
      skillIds: chapter.skillIds,
      sections: chapter.sections.map((section) => ({
        title: section.title,
        description: section.description,
      })),
    })),
  };
}

function hasStableOutlineShape(base: CourseOutline, refined: CourseOutline): boolean {
  if (base.chapters.length !== refined.chapters.length) {
    return false;
  }

  return base.chapters.every(
    (chapter, chapterIndex) =>
      chapter.sections.length === refined.chapters[chapterIndex]?.sections.length,
  );
}

function buildRefinementPrompt(
  baseOutline: CourseOutline,
  alignmentBrief: CourseBlueprintAlignmentBrief,
  generationContext?: GrowthGenerationContext,
) {
  return [
    "请基于下面的课程草案，输出最终课程蓝图。",
    "",
    "【基础课程草案】",
    JSON.stringify(baseOutline, null, 2),
    "",
    "【当前成长上下文】",
    formatGrowthGenerationContext(generationContext, { style: "detailed" }),
    "",
    "【课程与当前成长的对齐简报】",
    formatCourseBlueprintAlignmentBrief(alignmentBrief),
    "",
    "额外要求：",
    "- 默认保持当前章节数量和每章小节数量不变",
    "- 允许优化标题、描述、技能标签、练习类型和先修要求",
    "- 如果成长上下文显示明确焦点或缺口，要让课程前后结构更贴近当前成长需要",
    "- 不能偏离用户当前课程主题",
    "- 直接输出完整结构化课程蓝图",
  ].join("\n");
}

export async function expandInterviewOutlineToCourseOutline({
  userId,
  outline,
  generationContext,
  courseId,
}: ExpandInterviewOutlineToCourseOutlineOptions): Promise<CourseOutline> {
  const baseOutline = mapInterviewOutlineToCourseOutline(outline);
  const alignmentBrief = buildCourseBlueprintAlignmentBrief({
    courseTitle: baseOutline.title,
    courseDescription: baseOutline.description,
    courseSkillIds: baseOutline.courseSkillIds,
    chapterTitles: baseOutline.chapters.map((chapter) => chapter.title),
    chapterSkillIds: baseOutline.chapters.flatMap((chapter) => chapter.skillIds ?? []),
    generationContext,
  });

  if (!aiProvider.isConfigured()) {
    throw new APIError("AI 服务未配置", 503, "AI_NOT_CONFIGURED");
  }

  const startedAt = Date.now();
  const telemetry = createTelemetryContext({
    endpoint: "/api/interview/create-course",
    userId,
    workflow: "create-course-blueprint",
    promptVersion: "course-blueprint@v2",
    modelPolicy: "structured-high-quality",
    metadata: {
      courseId: courseId ?? null,
      hasGrowthContext: Boolean(generationContext),
      currentDirection: generationContext?.currentDirection?.directionKey ?? null,
      currentFocus: generationContext?.currentFocus?.anchorRef ?? null,
      insightCount: generationContext?.insights.length ?? 0,
      alignmentRelation: alignmentBrief.relation,
      alignmentFocus: alignmentBrief.focusTitle,
    },
  });

  try {
    const result = await generateText({
      model: getJsonModelForPolicy("structured-high-quality"),
      system: COURSE_BLUEPRINT_REFINER_PROMPT,
      prompt: buildRefinementPrompt(baseOutline, alignmentBrief, generationContext),
      temperature: 0.2,
      maxRetries: 1,
      output: Output.object({ schema: CourseOutlineSchema }),
    });

    const refinedOutline = result.output;
    if (!hasStableOutlineShape(baseOutline, refinedOutline)) {
      throw new Error("Course blueprint shape mismatch");
    }

    await recordAIUsage({
      ...telemetry,
      usage: result.usage,
      durationMs: Date.now() - startedAt,
      success: true,
      metadata: {
        ...telemetry.metadata,
        relevantInsightTitles: alignmentBrief.relevantInsightTitles,
      },
    });

    return refinedOutline;
  } catch (error) {
    await recordAIUsage({
      ...telemetry,
      durationMs: Date.now() - startedAt,
      success: false,
      errorMessage: getErrorMessage(error),
    });
    throw error;
  }
}
