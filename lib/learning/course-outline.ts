import { z } from "zod";
import {
  INTERVIEW_OUTLINE_CHAPTER_LIMITS,
  INTERVIEW_OUTLINE_SECTION_LIMITS,
  type InterviewOutline,
  InterviewOutlineSchema,
} from "@/lib/ai/interview/schemas";

const CoursePrerequisiteSchema = z.string().trim().min(1).max(120);

export const CourseOutlineSectionSchema = z.object({
  title: z.string().min(1).max(80),
  description: z.string().min(1).max(180).optional(),
});

export const CourseOutlineChapterSchema = z.object({
  title: z.string().min(1).max(120),
  sections: z
    .array(CourseOutlineSectionSchema)
    .min(INTERVIEW_OUTLINE_SECTION_LIMITS.min)
    .max(INTERVIEW_OUTLINE_SECTION_LIMITS.max),
  practiceType: z.enum(["exercise", "project", "quiz", "none"]).optional(),
  skillIds: z.array(z.string().trim().min(1).max(80)).min(1).max(4).optional(),
  description: z.string().min(1).max(220).optional(),
});

export const CourseOutlineSchema = InterviewOutlineSchema.extend({
  prerequisites: z.array(CoursePrerequisiteSchema).max(8).optional(),
  chapters: z
    .array(CourseOutlineChapterSchema)
    .min(INTERVIEW_OUTLINE_CHAPTER_LIMITS.min)
    .max(INTERVIEW_OUTLINE_CHAPTER_LIMITS.max),
});

export type CourseOutlineSection = z.infer<typeof CourseOutlineSectionSchema>;
export type CourseOutlineChapter = z.infer<typeof CourseOutlineChapterSchema>;
export type CourseOutline = z.infer<typeof CourseOutlineSchema>;

export function createCourseOutlineFromInterviewOutline(outline: InterviewOutline): CourseOutline {
  return CourseOutlineSchema.parse({
    title: outline.title,
    difficulty: outline.difficulty,
    chapters: outline.chapters.map((chapter) => ({
      title: chapter.title,
      sections: chapter.sections.map((section) => ({
        title: section.title,
      })),
      practiceType: chapter.practiceType,
      skillIds: chapter.skillIds,
    })),
    courseSkillIds: outline.courseSkillIds,
    description: outline.description,
    targetAudience: outline.targetAudience,
    learningOutcome: outline.learningOutcome,
    prerequisites: undefined,
  });
}
