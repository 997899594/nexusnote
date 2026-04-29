/**
 * Tag Generation Service
 *
 * 自动为笔记生成智能标签，支持：
 * - AI 生成标签 + 置信度
 * - 向量搜索匹配相似标签
 * - 自动合并语义相同的标签
 */

import { embed, generateText, Output } from "ai";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { notes, noteTags, tags } from "@/db/schema";
import { buildGenerationSettingsForPolicy } from "@/lib/ai/core/generation-settings";
import { getPlainModelForPolicy } from "@/lib/ai/core/model-policy";
import { aiProvider } from "@/lib/ai/core/provider";
import { createTelemetryContext, getErrorMessage, recordAIUsage } from "@/lib/ai/core/telemetry";
import { loadPromptResource, renderPromptResource } from "@/lib/ai/prompts/load-prompt";
import { syncTagUsageCount } from "@/lib/tags/usage-count";

// 配置参数
const CONFIG = {
  /** 标签合并相似度阈值（余弦距离 < 0.1 视为相同） */
  TAG_MERGE_THRESHOLD: 0.1,
  /** 自动确认的置信度阈值 */
  AUTO_CONFIRM_THRESHOLD: 0.7,
  /** 单个标签最大长度 */
  MAX_TAG_LENGTH: 100,
} as const;

const TAG_GENERATION_SYSTEM_PROMPT = loadPromptResource("tag-generation-system.md");
const TagGenerationResultSchema = z
  .object({
    tags: z.array(z.string()).min(1).max(5),
    confidence: z.array(z.number().min(0).max(1)),
  })
  .refine((data) => data.tags.length === data.confidence.length, {
    message: "tags 和 confidence 数组长度必须一致",
  });

type TagGenerationResult = z.infer<typeof TagGenerationResultSchema>;

function buildTagGenerationUserPrompt(content: string): string {
  return renderPromptResource("tag-generation-user.md", {
    content: content.slice(0, 3000),
  });
}

class TagGenerationService {
  /**
   * 为笔记生成标签
   */
  async generateTags(noteId: string): Promise<void> {
    // 1. 获取笔记内容
    const content = await this.getNoteContent(noteId);
    if (!content || content.length < 50) {
      console.log(`[Tags] 笔记 ${noteId} 内容过短，跳过标签生成`);
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
        await this.linkNoteTag(noteId, tag.id, confidence);
      } catch (error) {
        console.error(`[Tags] 处理标签 "${tagName}" 失败:`, error);
      }
    }

    console.log(`[Tags] 笔记 ${noteId} 生成 ${result.tags.length} 个标签`);
  }

  /**
   * 获取笔记纯文本内容
   */
  private async getNoteContent(noteId: string): Promise<string | null> {
    const [doc] = await db
      .select({ plainText: notes.plainText })
      .from(notes)
      .where(eq(notes.id, noteId))
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

    const startedAt = Date.now();
    const telemetry = createTelemetryContext({
      endpoint: "notes:tag-generation",
      intent: "note-tag-generation",
      modelPolicy: "extract-fast",
      promptVersion: "note-tag-generation@v1",
      metadata: {
        contentLength: content.length,
      },
    });

    try {
      const result = await generateText({
        model: getPlainModelForPolicy("extract-fast"),
        output: Output.object({ schema: TagGenerationResultSchema }),
        system: TAG_GENERATION_SYSTEM_PROMPT,
        prompt: buildTagGenerationUserPrompt(content),
        ...buildGenerationSettingsForPolicy("extract-fast", {
          temperature: 0.3,
        }),
        maxRetries: 2,
      });

      await recordAIUsage({
        ...telemetry,
        usage: result.usage,
        durationMs: Date.now() - startedAt,
        success: true,
        metadata: {
          ...telemetry.metadata,
          generatedTagCount: result.output.tags.length,
        },
      });

      return result.output;
    } catch (error) {
      await recordAIUsage({
        ...telemetry,
        durationMs: Date.now() - startedAt,
        success: false,
        errorMessage: getErrorMessage(error),
      });
      throw error;
    }
  }

  /**
   * 查找或创建标签（支持向量语义匹配）
   */
  private async findOrCreateTag(tagName: string): Promise<typeof tags.$inferSelect> {
    const normalizedName = tagName.trim().slice(0, CONFIG.MAX_TAG_LENGTH);

    // 1. 先精确匹配名称
    const [exactMatch] = await db.select().from(tags).where(eq(tags.name, normalizedName)).limit(1);

    if (exactMatch) {
      return exactMatch;
    }

    // 2. 生成 embedding（不可用时降级为精确匹配 + 直接创建）
    let embedding: number[] | null = null;
    try {
      embedding = await this.generateEmbedding(normalizedName);
    } catch (error) {
      console.warn(
        `[Tags] Embedding unavailable, skip semantic merge for "${normalizedName}"`,
        error,
      );
    }

    if (embedding) {
      // 3. 向量搜索相似标签
      const [similarTag] = await db
        .select()
        .from(tags)
        .where(
          and(
            sql`name_embedding IS NOT NULL`,
            sql`cosine_distance(name_embedding, ${JSON.stringify(embedding)}) < ${CONFIG.TAG_MERGE_THRESHOLD}`,
          ),
        )
        .limit(1);

      if (similarTag) {
        console.log(`[Tags] 标签 "${normalizedName}" 合并到相似标签 "${similarTag.name}"`);
        return similarTag;
      }
    }

    // 4. 创建新标签
    const [newTag] = await db
      .insert(tags)
      .values({
        name: normalizedName,
        nameEmbedding: embedding,
        usageCount: 0,
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
      model: aiProvider.embeddingModel,
      value: text,
    });

    return embedding;
  }

  /**
   * 关联笔记和标签
   */
  private async linkNoteTag(noteId: string, tagId: string, confidence: number): Promise<void> {
    const status = confidence >= CONFIG.AUTO_CONFIRM_THRESHOLD ? "confirmed" : "pending";
    const confirmedAt = status === "confirmed" ? new Date() : null;

    const [inserted] = await db
      .insert(noteTags)
      .values({
        noteId,
        tagId,
        confidence,
        status,
        confirmedAt,
      })
      .onConflictDoNothing()
      .returning({ id: noteTags.id });

    if (inserted) {
      await syncTagUsageCount(db, tagId);
      return;
    }

    await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({
          status: noteTags.status,
        })
        .from(noteTags)
        .where(and(eq(noteTags.noteId, noteId), eq(noteTags.tagId, tagId)))
        .limit(1);

      if (!existing) {
        return;
      }

      await tx
        .update(noteTags)
        .set({
          confidence,
          status,
          confirmedAt,
        })
        .where(and(eq(noteTags.noteId, noteId), eq(noteTags.tagId, tagId)));

      await syncTagUsageCount(tx, tagId);
    });
  }
}

// 导出单例
export const tagGenerationService = new TagGenerationService();
