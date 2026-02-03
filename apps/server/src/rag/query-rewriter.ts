/**
 * Query Rewriting Module
 *
 * 优化用户查询以提高 RAG 检索质量：
 * - 扩展缩写和简称
 * - 补充上下文信息
 * - 消除歧义
 * - 添加相关关键词
 */

import { generateText, Output } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { env } from '@nexusnote/config';
import { z } from 'zod';

// ============================================
// AI Model Configuration
// ============================================

const openai = env.AI_302_API_KEY
  ? createOpenAI({
      baseURL: 'https://api.302.ai/v1',
      apiKey: env.AI_302_API_KEY,
    })
  : null;

const fastModel = openai ? openai(env.AI_FAST_MODEL || 'gemini-3-flash-preview') : null;

// ============================================
// Query Rewriting Schema
// ============================================

const QueryRewriteSchema = z.object({
  rewrittenQuery: z.string().describe('改写后的查询，更适合向量检索'),
  reasoning: z.string().optional().describe('改写原因'),
  shouldRewrite: z.boolean().describe('是否需要改写'),
});

type QueryRewriteResult = z.infer<typeof QueryRewriteSchema>;

// ============================================
// Query Rewriter
// ============================================

export interface QueryRewriteOptions {
  /** 对话上下文（可选） */
  conversationContext?: string;
  /** 是否启用查询扩展 */
  expandQuery?: boolean;
  /** 是否强制改写（默认 false，LLM 自动判断） */
  forceRewrite?: boolean;
}

/**
 * 改写用户查询以提高检索质量
 *
 * @example
 * ```typescript
 * const result = await rewriteQuery('它怎么收费');
 * // result.rewrittenQuery: "NexusNote 的定价策略和收费方式"
 * ```
 */
export async function rewriteQuery(
  originalQuery: string,
  options: QueryRewriteOptions = {},
): Promise<string> {
  if (!fastModel) {
    console.warn('[Query Rewriter] No model configured, using original query');
    return originalQuery;
  }

  // 如果查询已经很清晰（>= 10 个字且包含关键词），可能不需要改写
  const isExplicit = originalQuery.length >= 10 && /[a-zA-Z0-9\u4e00-\u9fa5]{3,}/.test(originalQuery);

  try {
    const result = await generateText({
      model: fastModel,
      output: Output.object({
        schema: QueryRewriteSchema,
      }),
      prompt: `你是一个查询优化专家。你的任务是判断是否需要改写用户查询，以提高向量检索的质量。

## 用户查询
"${originalQuery}"

${options.conversationContext ? `## 对话上下文\n${options.conversationContext}\n` : ''}

## 改写规则
1. **扩展代词和简称**：
   - "它" → 明确指代的对象（例如："NexusNote"）
   - "怎么用" → "如何使用 [功能名称]"
   - "为什么" → "为什么 [具体问题]"

2. **添加关键信息**：
   - 补充领域名词
   - 添加同义词
   - 扩展缩写

3. **消除歧义**：
   - 明确查询意图（操作指南 vs 概念解释）
   - 指定范围（功能 vs 价格 vs 使用方法）

4. **不要过度改写**：
   - 如果查询已经清晰明确，设置 shouldRewrite=false
   - 保留专业术语和特定名称

## 示例
- "它怎么收费" → "NexusNote 的定价策略和收费方式"
- "RAG 是什么" → "RAG（检索增强生成）的定义和工作原理"
- "如何创建文档" → "如何在 NexusNote 中创建和编辑文档"（扩展）
- "NexusNote 支持 Markdown 吗" → 不改写（已经很清晰）

请返回改写结果。如果查询已经足够清晰，设置 shouldRewrite=false 并返回原查询。`,
      temperature: 0.2, // 低温度，保持一致性
      maxRetries: 2,
    });

    const rewriteResult = result.experimental_output as QueryRewriteResult;

    // 如果 LLM 判断不需要改写，或强制不改写
    if (!options.forceRewrite && !rewriteResult.shouldRewrite) {
      console.log(`[Query Rewriter] No rewrite needed: "${originalQuery}"`);
      return originalQuery;
    }

    const rewritten = rewriteResult.rewrittenQuery;
    console.log(`[Query Rewriter] "${originalQuery}" → "${rewritten}"`);

    if (rewriteResult.reasoning) {
      console.log(`[Query Rewriter] Reasoning: ${rewriteResult.reasoning}`);
    }

    return rewritten;
  } catch (err) {
    console.error('[Query Rewriter] Failed:', err instanceof Error ? err.message : err);
    return originalQuery; // 失败时返回原查询
  }
}

/**
 * 批量改写查询（用于生成多个检索变体）
 */
export async function rewriteQueryVariants(
  originalQuery: string,
  variantCount: number = 3,
): Promise<string[]> {
  if (!fastModel) {
    return [originalQuery];
  }

  try {
    const result = await generateText({
      model: fastModel,
      output: Output.object({
        schema: z.object({
          variants: z.array(z.string()).describe('查询变体列表'),
        }),
      }),
      prompt: `生成 ${variantCount} 个语义相似但表述不同的查询变体，用于提高检索召回率。

## 原始查询
"${originalQuery}"

## 要求
1. 保持语义一致
2. 使用不同的词汇和表述方式
3. 覆盖不同的检索角度（定义、方法、原理等）

## 示例
原查询: "如何使用 AI 助手"
变体:
1. "NexusNote AI 助手的使用方法和操作指南"
2. "与 AI 助手对话的步骤和技巧"
3. "AI 助手功能介绍和应用场景"

请生成 ${variantCount} 个变体：`,
      temperature: 0.5,
      maxRetries: 2,
    });

    const variants = (result.experimental_output as any).variants as string[];
    console.log(`[Query Rewriter] Generated ${variants.length} variants for: "${originalQuery}"`);

    return [originalQuery, ...variants]; // 包含原查询
  } catch (err) {
    console.error('[Query Rewriter] Variant generation failed:', err);
    return [originalQuery];
  }
}
