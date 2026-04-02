/**
 * Tag Generation Prompt
 *
 * 用于从文档内容生成智能标签
 */

import { z } from "zod";
import { loadPromptResource } from "./load-prompt";

/** 文档内容最大长度，用于限制 AI 输入 */
const MAX_CONTENT_LENGTH = 3000;

export const TAG_GENERATION_SYSTEM_PROMPT = loadPromptResource("tag-generation-system.md");

export const TAG_GENERATION_USER_PROMPT = (content: string) => `请为以下文档生成标签：

${content.slice(0, MAX_CONTENT_LENGTH)}`;

// Zod schema for validation
export const TagGenerationResultSchema = z
  .object({
    tags: z.array(z.string()).min(1).max(5),
    confidence: z.array(z.number().min(0).max(1)),
  })
  .refine((data) => data.tags.length === data.confidence.length, {
    message: "tags 和 confidence 数组长度必须一致",
  });

export type TagGenerationResult = z.infer<typeof TagGenerationResultSchema>;
