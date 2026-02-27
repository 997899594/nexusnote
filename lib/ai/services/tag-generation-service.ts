/**
 * Tag Generation Service
 *
 * 自动为文档生成智能标签，支持：
 * - AI 生成标签 + 置信度
 * - 向量搜索匹配相似标签
 * - 自动合并语义相同的标签
 */

import { embed } from "ai";
import { eq, and, sql } from "drizzle-orm";
import { db } from "@/db";
import { documents, documentTags, tags } from "@/db/schema";
import { aiProvider, safeGenerateObject } from "@/lib/ai";
import {
  TAG_GENERATION_SYSTEM_PROMPT,
  TAG_GENERATION_USER_PROMPT,
  TagGenerationResultSchema,
  type TagGenerationResult,
} from "../prompts/tag-generation";

// 配置参数
const CONFIG = {
  /** 标签合并相似度阈值（余弦距离 < 0.1 视为相同） */
  TAG_MERGE_THRESHOLD: 0.1,
  /** 自动确认的置信度阈值 */
  AUTO_CONFIRM_THRESHOLD: 0.7,
  /** 单个标签最大长度 */
  MAX_TAG_LENGTH: 100,
} as const;

class TagGenerationService {
  /**
   * 为文档生成标签
   */
  async generateTags(documentId: string): Promise<void> {
    // 1. 获取文档内容
    const content = await this.getDocumentContent(documentId);
    if (!content || content.length < 50) {
      console.log(`[Tags] 文档 ${documentId} 内容过短，跳过标签生成`);
      return;
    }

    // 2. AI 生成标签
    const result = await this.generateTagsWithAI(content);

    // 3. 为每个标签建立关联
    for (let i = 0; i < result.tags.length; i++) {
      const tagName = result.tags[i];
      const confidence = result.confidence[i] ?? 0.5;

      try {
        const tag = await this.findOrCreateTag(tagName);
        await this.linkDocumentTag(documentId, tag.id, confidence);
      } catch (error) {
        console.error(`[Tags] 处理标签 "${tagName}" 失败:`, error);
      }
    }

    console.log(`[Tags] 文档 ${documentId} 生成 ${result.tags.length} 个标签`);
  }

  /**
   * 获取文档纯文本内容
   */
  private async getDocumentContent(documentId: string): Promise<string | null> {
    const [doc] = await db
      .select({ plainText: documents.plainText })
      .from(documents)
      .where(eq(documents.id, documentId))
      .limit(1);

    return doc?.plainText ?? null;
  }

  /**
   * 调用 AI 生成标签
   */
  private async generateTagsWithAI(content: string): Promise<TagGenerationResult> {
    if (!aiProvider.isConfigured()) {
      throw new Error("AI Provider not configured");
    }

    const result = await safeGenerateObject({
      schema: TagGenerationResultSchema,
      model: aiProvider.chatModel,
      system: TAG_GENERATION_SYSTEM_PROMPT,
      prompt: TAG_GENERATION_USER_PROMPT(content),
      temperature: 0.3,
      maxRetries: 2,
    });

    return result;
  }

  /**
   * 查找或创建标签（支持向量语义匹配）
   */
  private async findOrCreateTag(tagName: string): Promise<typeof tags.$inferSelect> {
    const normalizedName = tagName.trim().slice(0, CONFIG.MAX_TAG_LENGTH);

    // 1. 先精确匹配名称
    const [exactMatch] = await db
      .select()
      .from(tags)
      .where(eq(tags.name, normalizedName))
      .limit(1);

    if (exactMatch) {
      await this.incrementTagUsage(exactMatch.id);
      return exactMatch;
    }

    // 2. 生成 embedding
    const embedding = await this.generateEmbedding(normalizedName);

    // 3. 向量搜索相似标签
    const [similarTag] = await db
      .select()
      .from(tags)
      .where(
        and(
          sql`name_embedding IS NOT NULL`,
          sql`cosine_distance(name_embedding, ${JSON.stringify(embedding)}) < ${CONFIG.TAG_MERGE_THRESHOLD}`
        )
      )
      .limit(1);

    if (similarTag) {
      console.log(`[Tags] 标签 "${normalizedName}" 合并到相似标签 "${similarTag.name}"`);
      await this.incrementTagUsage(similarTag.id);
      return similarTag;
    }

    // 4. 创建新标签
    const [newTag] = await db
      .insert(tags)
      .values({
        name: normalizedName,
        nameEmbedding: embedding,
        usageCount: 1,
      })
      .returning();

    return newTag;
  }

  /**
   * 生成文本 embedding
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    if (!aiProvider.isConfigured()) {
      throw new Error("AI Provider not configured");
    }

    const { embedding } = await embed({
      model: aiProvider.embeddingModel as any,
      value: text,
    });

    return embedding;
  }

  /**
   * 增加标签使用计数
   */
  private async incrementTagUsage(tagId: string): Promise<void> {
    await db
      .update(tags)
      .set({
        usageCount: sql`${tags.usageCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(tags.id, tagId));
  }

  /**
   * 关联文档和标签
   */
  private async linkDocumentTag(
    documentId: string,
    tagId: string,
    confidence: number
  ): Promise<void> {
    const status = confidence >= CONFIG.AUTO_CONFIRM_THRESHOLD ? "confirmed" : "pending";
    const confirmedAt = status === "confirmed" ? new Date() : null;

    await db
      .insert(documentTags)
      .values({
        documentId,
        tagId,
        confidence,
        status,
        confirmedAt,
      })
      .onConflictDoUpdate({
        target: [documentTags.documentId, documentTags.tagId],
        set: {
          confidence,
          status,
          confirmedAt,
        },
      });
  }
}

// 导出单例
export const tagGenerationService = new TagGenerationService();
