/**
 * Learn Context Tools
 *
 * On-demand loading of course chapter content.
 * Agent decides when and what to load, without prompt stuffing.
 */

import { tool } from "ai";
import { z } from "zod";
import type { ToolContext } from "@/lib/ai/core/tool-context";
import { getChapterContent } from "@/lib/cache/course-context";

const SECTION_MAX_CHARS = 3000;

export function createLearnContextTools(ctx: ToolContext) {
  const courseId = ctx.resourceId;
  if (!courseId) {
    throw new Error("Learn context tools require resourceId (courseId)");
  }

  return {
    loadLearnContext: tool({
      description:
        "加载当前课程指定章节的教学内容，并返回章节描述与能力目标。在回答学习相关问题前调用此工具获取章节详细内容。可选择性加载特定小节。",
      inputSchema: z.object({
        chapterIndex: z.number().int().min(0).describe("章节索引（从 0 开始）"),
        sectionIndices: z
          .array(z.number().int().min(0))
          .optional()
          .describe("要加载的小节索引列表（从 0 开始）。不传则加载全部小节"),
      }),
      execute: async ({ chapterIndex, sectionIndices }) => {
        const chapter = await getChapterContent(courseId, chapterIndex);
        if (!chapter) {
          return { error: "章节内容未找到", chapterIndex };
        }

        const sections =
          sectionIndices && sectionIndices.length > 0
            ? sectionIndices
                .filter((index) => index >= 0 && index < chapter.sections.length)
                .map((index) => chapter.sections[index])
            : chapter.sections;

        const truncatedSections = sections.map((section) => ({
          title: section.title,
          text:
            section.text.length > SECTION_MAX_CHARS
              ? `${section.text.slice(0, SECTION_MAX_CHARS)}…（内容已截断）`
              : section.text,
        }));

        return {
          chapterTitle: chapter.chapterTitle,
          chapterDescription: chapter.chapterDescription,
          chapterSkillIds: chapter.chapterSkillIds,
          courseSkillIds: chapter.courseSkillIds,
          chapterIndex,
          sectionCount: chapter.sections.length,
          loadedSections: truncatedSections.length,
          sections: truncatedSections,
        };
      },
    }),
  };
}
