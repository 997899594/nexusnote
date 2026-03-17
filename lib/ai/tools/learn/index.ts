/**
 * Learn Context Tools
 *
 * On-demand loading of course chapter content.
 * Agent decides when and what to load — no prompt stuffing.
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
        "加载当前课程指定章节的教学内容。在回答学习相关问题前调用此工具获取章节详细内容。可选择性加载特定小节。",
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

        let sections = chapter.sections;

        // Filter by requested section indices
        if (sectionIndices && sectionIndices.length > 0) {
          sections = sectionIndices
            .filter((i) => i >= 0 && i < chapter.sections.length)
            .map((i) => chapter.sections[i]);
        }

        // Truncate each section to limit
        const truncated = sections.map((s) => ({
          title: s.title,
          text:
            s.text.length > SECTION_MAX_CHARS
              ? `${s.text.slice(0, SECTION_MAX_CHARS)}…（内容已截断）`
              : s.text,
        }));

        return {
          chapterTitle: chapter.chapterTitle,
          chapterIndex,
          sectionCount: chapter.sections.length,
          loadedSections: truncated.length,
          sections: truncated,
        };
      },
    }),
  };
}
