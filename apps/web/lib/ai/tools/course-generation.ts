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

import { tool, type ToolSet } from "ai";
import { z } from "zod";
import {
  saveCourseChapter,
  getCourseChapters,
} from "@/lib/ai/profile/course-profile";
import { generateIllustrationTool } from "./multimodal";
import { generateQuiz, mindMap } from "./chat/learning";

/**
 * checkGenerationProgress - 检查当前课程的生成进度
 *
 * 语义：AI 查询数据库中已有的章节，确定下一步该生成什么
 * 调用时机：生成任务开始时，或者 AI 需要确认进度时
 */
export const checkGenerationProgressTool = tool({
  description: `查询数据库中已有的章节，返回已生成的章节索引列表。用于确定生成任务的起点或断点续传。`,
  inputSchema: z.object({
    profileId: z.string().uuid().describe("课程画像 ID"),
  }),

  execute: async ({ profileId }) => {
    console.log(`[checkGenerationProgress] 检查画像 ID: ${profileId}`);
    try {
      // 架构师改进：直接从数据库获取最真实的章节列表
      const chapters = await getCourseChapters(profileId);
      const generatedIndices = chapters
        .map((c) => c.chapterIndex)
        .sort((a, b) => a - b);

      console.log(
        `[checkGenerationProgress] 已生成章节索引:`,
        generatedIndices,
      );

      // 计算下一个需要生成的索引
      let nextIndex = 0;
      if (generatedIndices.length > 0) {
        // 寻找缺失的第一个索引，或者返回最大索引 + 1
        for (let i = 0; i <= Math.max(...generatedIndices); i++) {
          if (!generatedIndices.includes(i)) {
            nextIndex = i;
            break;
          }
        }
        if (nextIndex === 0 && generatedIndices.includes(0)) {
          nextIndex = Math.max(...generatedIndices) + 1;
        }
      }

      return {
        status: "success",
        generatedIndices,
        count: generatedIndices.length,
        nextToGenerate: nextIndex,
        isComplete: false, // 由 Agent 根据总数判断
      };
    } catch (error) {
      console.error("[checkGenerationProgress] 检查失败:", error);
      return {
        status: "error",
        message: "查询进度失败",
      };
    }
  },
});

/**
 * saveChapterContent - 保存课程章节内容到数据库
 *
 * 语义：AI 已生成了一个完整的章节内容，直接保存到数据库
 * 调用时机：每生成完一个章节就调用一次
 */
const saveChapterContentSchema = z.object({
  profileId: z.string().uuid().describe("课程画像 ID"),
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
    console.log(`[saveChapterContent] 画像 ID: ${params.profileId}`);
    console.log(`[saveChapterContent] 标题: ${params.title}`);
    console.log(
      `[saveChapterContent] 内容长度: ${params.contentMarkdown.length} 字符`,
    );

    try {
      // 直接在后端执行保存操作到数据库
      await saveCourseChapter({
        profileId: params.profileId,
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
export const courseGenerationTools: ToolSet = {
  checkGenerationProgress: checkGenerationProgressTool,
  saveChapterContent: saveChapterContentTool,
  markGenerationComplete: markGenerationCompleteTool,
  generateIllustration: generateIllustrationTool,
  generateQuiz: generateQuiz,
  mindMap: mindMap,
};

/**
 * 导出工具名称类型
 */
export type CourseGenerationToolName = keyof typeof courseGenerationTools;
