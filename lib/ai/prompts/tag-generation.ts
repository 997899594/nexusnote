/**
 * Tag Generation Prompt
 *
 * 用于从文档内容生成智能标签
 */

import { z } from "zod";

/** 文档内容最大长度，用于限制 AI 输入 */
const MAX_CONTENT_LENGTH = 3000;

export const TAG_GENERATION_SYSTEM_PROMPT = `你是一个专业的知识标签生成助手。根据文档内容生成准确、简洁的标签。

规则：
1. 生成 3-5 个标签
2. 标签应该是具体的技术名词或领域概念
3. 优先选择文档中明确提到的关键词
4. 为每个标签提供 0-1 的置信度分数
5. 返回严格的 JSON 格式，不要有其他文字

返回格式示例：
{"tags": ["React", "前端开发", "组件设计"], "confidence": [0.95, 0.85, 0.72]}`;

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
