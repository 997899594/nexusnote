/**
 * Learning Tools - 课程生成
 */

import { tool } from "ai";
import { z } from "zod";
import { courseProfiles, db, documents, eq } from "@/db";

export const GenerateCourseSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]).default("intermediate"),
  chapters: z.number().int().min(3).max(20).default(8),
  targetAudience: z.string().max(200).default("general"),
});

export type GenerateCourseInput = z.infer<typeof GenerateCourseSchema>;

export const generateCourseTool = tool({
  description: "根据主题生成完整课程",
  inputSchema: GenerateCourseSchema,
  execute: async (args) => {
    try {
      const [profile] = await db
        .insert(courseProfiles)
        .values({
          title: args.title,
          description: args.description,
          difficulty: args.difficulty,
          interviewStatus: "generating",
          status: "chapter_generating",
        })
        .returning();

      for (let i = 0; i < args.chapters; i++) {
        await db.insert(documents).values({
          type: "course_chapter",
          title: `第 ${i + 1} 章`,
          courseProfileId: profile.id,
          outlineNodeId: `chapter-${i + 1}`,
          content: Buffer.from(
            JSON.stringify({
              type: "doc",
              content: [
                {
                  type: "heading",
                  attrs: { level: 1 },
                  content: [{ type: "text", text: `第 ${i + 1} 章` }],
                },
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "本章节内容生成中..." }],
                },
              ],
            }),
          ),
        });
      }

      await db
        .update(courseProfiles)
        .set({
          interviewStatus: "completed",
          status: "completed",
          progress: {
            currentChapter: args.chapters,
            completedChapters: [],
            totalChapters: args.chapters,
            startedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
          },
        })
        .where(eq(courseProfiles.id, profile.id));

      return {
        success: true,
        courseId: profile.id,
        title: profile.title,
        chapters: args.chapters,
      };
    } catch (error) {
      console.error("[Tool] generateCourse error:", error);
      return {
        success: false,
        error: "生成课程失败",
      };
    }
  },
});

export const CheckCourseProgressSchema = z.object({
  courseId: z.string().uuid(),
});

export const checkCourseProgressTool = tool({
  description: "检查课程生成进度",
  inputSchema: CheckCourseProgressSchema,
  execute: async (args) => {
    try {
      const [profile] = await db
        .select()
        .from(courseProfiles)
        .where(eq(courseProfiles.id, args.courseId))
        .limit(1);

      if (!profile) {
        return { success: false, error: "课程不存在" };
      }

      const chapters = await db
        .select()
        .from(documents)
        .where(eq(documents.courseProfileId, profile.id));

      const generatedChapters = chapters.filter((c) => c.content && c.content.length > 0).length;
      const totalChapters = chapters.length;
      const progressData = profile.progress as {
        currentChapter?: number;
        completedChapters?: number[];
      } | null;

      return {
        success: true,
        courseId: profile.id,
        title: profile.title,
        status: profile.status,
        progress: `${generatedChapters}/${totalChapters}`,
        isCompleted: profile.status === "completed",
        currentChapter: progressData?.currentChapter || 0,
      };
    } catch (error) {
      console.error("[Tool] checkCourseProgress error:", error);
      return { success: false, error: "获取进度失败" };
    }
  },
});
