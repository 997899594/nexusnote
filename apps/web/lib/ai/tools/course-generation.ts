/**
 * Course Generation Tools
 * 用于生成和保存课程章节内容
 *
 * 设计原则：
 * 1. 工具在后端直接执行，保存到数据库
 * 2. 前端无需干预，通过 useEffect 定期刷新获取数据
 * 3. 通过 Zod Schema 进行输入验证
 *
 * 注意：工具执行在 API 路由（后端）中，与前端完全解耦
 */

import { tool } from "ai";
import { z } from "zod";
import { saveCourseChapter } from "@/lib/ai/profile/course-profile";

/**
 * saveChapterContent - 保存课程章节内容到数据库
 *
 * 语义：AI 已生成了一个完整的章节内容，直接保存到数据库
 * 调用时机：每生成完一个章节就调用一次
 */
const saveChapterContentSchema = z.object({
  courseId: z.string().uuid().describe("课程 ID"),
  chapterIndex: z.number().describe("章节索引（从 0 开始）"),
  sectionIndex: z.number().describe("小节索引（从 0 开始）"),
  title: z.string().describe("章节标题"),
  contentMarkdown: z
    .string()
    .min(200)
    .describe("章节内容（Markdown 格式，至少 200 字）"),
});

export const saveChapterContentTool = tool({
  description: `保存生成的课程章节内容到数据库。当完成一个章节的内容生成后调用此工具。`,
  inputSchema: saveChapterContentSchema,

  execute: async (params) => {
    console.log(
      `[saveChapterContent] 保存章节: Chapter ${params.chapterIndex} Section ${params.sectionIndex}`,
    );
    console.log(`[saveChapterContent] 课程 ID: ${params.courseId}`);
    console.log(`[saveChapterContent] 标题: ${params.title}`);
    console.log(
      `[saveChapterContent] 内容长度: ${params.contentMarkdown.length} 字符`,
    );

    try {
      // 直接在后端执行保存操作到数据库
      await saveCourseChapter({
        courseId: params.courseId,
        chapterIndex: params.chapterIndex,
        sectionIndex: params.sectionIndex,
        title: params.title,
        contentMarkdown: params.contentMarkdown,
      });

      console.log(
        `[saveChapterContent] ✅ 章节已保存: Chapter ${params.chapterIndex} Section ${params.sectionIndex}`,
      );

      return {
        status: "success",
        message: "章节已保存到数据库",
        chapterIndex: params.chapterIndex,
        sectionIndex: params.sectionIndex,
        title: params.title,
        contentLength: params.contentMarkdown.length,
      };
    } catch (error) {
      console.error("[saveChapterContent] 保存失败:", error);
      return {
        status: "error",
        message: error instanceof Error ? error.message : "保存失败",
        chapterIndex: params.chapterIndex,
        sectionIndex: params.sectionIndex,
      };
    }
  },
});

/**
 * markGenerationComplete - 标记课程生成完毕
 *
 * 语义：所有章节都已生成完毕，课程已准备好供学生学习
 * 调用时机：最后一个章节生成完毕后
 */
export const markGenerationCompleteTool = tool({
  description: `标记课程生成流程完毕。当所有章节都已生成后调用此工具。`,

  inputSchema: z.object({
    message: z.string().describe("完成消息，如'课程已生成完毕！'"),
  }),

  execute: async (params) => {
    console.log("[markGenerationComplete]", params.message);

    return {
      status: "generation_complete",
      timestamp: new Date().toISOString(),
    };
  },
});

/**
 * 导出所有 Course Generation 工具的集合
 */
export const courseGenerationTools = {
  saveChapterContent: saveChapterContentTool,
  markGenerationComplete: markGenerationCompleteTool,
};

/**
 * 导出工具名称类型
 */
export type CourseGenerationToolName = keyof typeof courseGenerationTools;
