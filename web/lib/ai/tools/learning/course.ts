/**
 * Learning Tools - 课程生成
 */

import { tool } from "ai";
import { z } from "zod";
import { courseChapters, courseProfiles, db, eq } from "@/db";

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
      // 创建课程配置
      const [profile] = await db
        .insert(courseProfiles)
        .values({
          title: args.title,
          description: args.description,
          difficulty: args.difficulty,
          interviewStatus: "generating",
        })
        .returning();

      // 生成章节内容
      const chapters = [];
      for (let i = 0; i < args.chapters; i++) {
        const [chapter] = await db
          .insert(courseChapters)
          .values({
            profileId: profile.id,
            chapterIndex: i,
            sectionIndex: 1,
            title: `第 ${i + 1} 章：${args.title} - 章节 ${i + 1}`,
            contentMarkdown: `# 第 ${i + 1} 章\n\n本章节将深入讲解...\n\n## 主要内容\n\n- 知识点 1\n- 知识点 2\n- 知识点 3\n\n## 小结\n\n本章学习了...`,
          })
          .returning();
        chapters.push(chapter);
      }

      // 更新状态
      await db
        .update(courseProfiles)
        .set({
          interviewStatus: "completed",
          isCompleted: true,
        })
        .where(eq(courseProfiles.id, profile.id));

      return {
        success: true,
        courseId: profile.id,
        title: profile.title,
        chapters: chapters.length,
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
      const profile = await db.query.courseProfiles.findFirst({
        where: eq(courseProfiles.id, args.courseId),
        with: {
          chapters: true,
        },
      });

      if (!profile) {
        return { success: false, error: "课程不存在" };
      }

      const generatedChapters = profile.chapters.filter((c) => c.isGenerated).length;
      const totalChapters = profile.chapters.length;

      return {
        success: true,
        courseId: profile.id,
        title: profile.title,
        status: profile.interviewStatus,
        progress: `${generatedChapters}/${totalChapters}`,
        isCompleted: profile.isCompleted,
      };
    } catch (error) {
      console.error("[Tool] checkCourseProgress error:", error);
      return { success: false, error: "获取进度失败" };
    }
  },
});
