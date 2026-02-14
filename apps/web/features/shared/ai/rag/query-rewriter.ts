/**
 * Query Rewriter — LLM 驱动的查询改写
 *
 * 解决问题：
 * - "我之前写的那个" 等指代性查询
 * - 口语化查询向量检索效果差
 * - 上下文缺失的模糊查询
 *
 * 用 fast model 低延迟改写，改写失败则 fallback 到原始查询
 */

import { generateText } from "ai";
import { registry } from "../registry";

/**
 * 将用户口语化查询改写为适合向量检索的关键词查询
 *
 * @param query 原始用户查询
 * @param conversationContext 最近对话上下文（用于解析指代）
 * @returns 改写后的查询（失败则返回原始查询）
 */
export async function rewriteQuery(query: string, conversationContext?: string): Promise<string> {
  if (!registry.fastModel) {
    return query;
  }

  // 短查询（< 10 字）且无上下文，直接返回
  if (query.length < 10 && !conversationContext) {
    return query;
  }

  try {
    const { text } = await generateText({
      model: registry.fastModel,
      temperature: 0,
      maxOutputTokens: 100,
      system: `你是查询改写器。将用户的口语化查询改写为适合向量检索的关键词查询。
保留核心语义，去除指代词，补充上下文隐含的实体。
只输出改写后的查询，不要解释。`,
      prompt: conversationContext
        ? `对话上下文：${conversationContext}\n用户查询：${query}`
        : `用户查询：${query}`,
    });

    const rewritten = text.trim();
    // 安全检查：改写结果不能为空，不能比原查询长太多
    if (rewritten && rewritten.length <= query.length * 3) {
      return rewritten;
    }
    return query;
  } catch (err) {
    console.warn("[QueryRewriter] 改写失败，使用原始查询:", err);
    return query;
  }
}
