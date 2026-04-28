import { generateText, Output } from "ai";
import { z } from "zod";
import { getJsonModelForPolicy } from "@/lib/ai/core/model-policy";
import { aiProvider } from "@/lib/ai/core/provider";
import { createTelemetryContext, getErrorMessage, recordAIUsage } from "@/lib/ai/core/telemetry";
import { type InterviewOutline, InterviewOutlineSchema } from "@/lib/ai/interview/schemas";
import { loadPromptResource, renderPromptResource } from "@/lib/ai/prompts/load-prompt";
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
  chapters: z.array(CourseOutlineChapterSchema).min(6).max(7),
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
  return renderPromptResource("growth/course-blueprint-user.md", {
    base_outline: JSON.stringify(baseOutline, null, 2),
    growth_context: formatGrowthGenerationContext(generationContext, { style: "detailed" }),
    alignment_brief: formatCourseBlueprintAlignmentBrief(alignmentBrief),
  });
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
