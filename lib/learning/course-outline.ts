import { z } from "zod";
import { type InterviewOutline, InterviewOutlineSchema } from "@/lib/ai/interview/schemas";

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

export function createCourseOutlineFromInterviewOutline(outline: InterviewOutline): CourseOutline {
  return CourseOutlineSchema.parse({
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
  });
}
