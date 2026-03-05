/**
 * Blueprint Generator
 *
 * 异步生成主题评分蓝图
 * LLM 生成规则 + 本地代码执行
 */

import { generateObject } from "ai";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { topicBlueprints } from "@/db/schema";
import type {
  CoreDimension,
  PendingFact,
  SaturationEvaluation,
  TopicBlueprint,
} from "@/types/interview";
import { aiProvider } from "../core";
import { clearBlueprintCache, getBlueprint } from "./cache";

// ============================================
// Schema for AI generation
// ============================================

const BlueprintSchema = z.object({
  coreDimensions: z
    .array(
      z.object({
        name: z.string().describe("维度名称，如'编程基础'、 '学习目标'"),
        keywords: z.array(z.string()).describe("匹配关键词，用于匹配用户提到的信息"),
        weight: z.number().min(0).max(100).describe("权重，所有维度权重之和应为100"),
        suggestion: z.string().describe("建议提问方向"),
      }),
    )
    .min(3)
    .max(5)
    .describe("3-5个核心评估维度"),
});

// Blueprint status validation schema
const BlueprintStatusSchema = z.enum(["pending", "ready", "failed"]);

// ============================================
// Hash Function
// ============================================

/**
 * 生成主题哈希（标准化 + 简单哈希）
 * 用于快速匹配和缓存键
 */
export function hashTopic(topic: string): string {
  // 标准化：小写、去空格、去特殊字符、取前50字符（保留中文字符）
  const normalized = topic
    .toLowerCase()
    .trim()
    .replace(/[^\w\u4e00-\u9fff]/g, "")
    .slice(0, 50);

  // 简单哈希（避免 crypto 开销）
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

// ============================================
// Helper: Wait for blueprint to be ready
// ============================================

const MAX_WAIT_MS = 30000; // 30 seconds max wait
const POLL_INTERVAL_MS = 500;

/**
 * 等待蓝图变为 ready 状态
 * 用于处理并发请求场景
 */
async function waitForBlueprint(topicHash: string): Promise<TopicBlueprint | null> {
  const startTime = Date.now();

  while (Date.now() - startTime < MAX_WAIT_MS) {
    const blueprint = await db.query.topicBlueprints.findFirst({
      where: (t, { eq }) => eq(t.topicHash, topicHash),
    });

    if (!blueprint) {
      return null;
    }

    if (blueprint.status === "ready") {
      return validateBlueprint(blueprint);
    }

    if (blueprint.status === "failed") {
      throw new Error(`Blueprint generation failed: ${blueprint.errorMessage}`);
    }

    // Still pending, wait and retry
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error("Blueprint generation timeout");
}

// ============================================
// Type Validation (使用 Zod 替代手动 typeof)
// ============================================

// DB Record 的 Zod Schema
const DBBlueprintSchema = z.object({
  id: z.string(),
  topic: z.string(),
  topicHash: z.string(),
  status: BlueprintStatusSchema,
  coreDimensions: z.array(
    z.object({
      name: z.string(),
      keywords: z.array(z.string()),
      weight: z.number(),
      suggestion: z.string(),
    }),
  ),
  pendingFacts: z
    .array(
      z.object({
        dimension: z.string(),
        value: z.union([z.string(), z.number(), z.boolean()]),
        type: z.enum(["string", "number", "boolean"]),
        confidence: z.number(),
        extractedAt: z.string(),
        topicId: z.string(),
        isShared: z.boolean(),
      }),
    )
    .nullable()
    .optional(),
  modelUsed: z.string().default("unknown"),
  errorMessage: z.string().nullable().optional(),
  createdAt: z.union([z.date(), z.null()]).optional(),
  updatedAt: z.union([z.date(), z.null()]).optional(),
});

/**
 * 验证数据库记录转换为 TopicBlueprint
 * 使用 Zod 进行类型安全的验证
 */
function validateBlueprint(record: unknown): TopicBlueprint {
  const parsed = DBBlueprintSchema.parse(record);

  return {
    id: parsed.id,
    topic: parsed.topic,
    topicHash: parsed.topicHash,
    coreDimensions: parsed.coreDimensions.map((d) => ({
      name: d.name,
      keywords: d.keywords,
      weight: d.weight,
      suggestion: d.suggestion,
    })),
    status: parsed.status,
    pendingFacts: parsed.pendingFacts ?? null,
    modelUsed: parsed.modelUsed,
    errorMessage: parsed.errorMessage ?? null,
    createdAt: parsed.createdAt ?? null,
    updatedAt: parsed.updatedAt ?? null,
  };
}

// ============================================
// Generator
// ============================================

/**
 * 生成主题评分蓝图
 * 使用轻量模型异步生成
 *
 * 并发安全：使用 ON CONFLICT DO NOTHING 防止重复生成
 */
export async function generateTopicBlueprint(topic: string): Promise<TopicBlueprint> {
  const topicHash = hashTopic(topic);

  // 1. 先检查是否已存在（快速路径）
  const existing = await db.query.topicBlueprints.findFirst({
    where: (t, { eq }) => eq(t.topicHash, topicHash),
  });

  if (existing && existing.status === "ready") {
    console.log("[Blueprint] Found existing ready:", topicHash);
    return validateBlueprint(existing);
  }

  if (existing && existing.status === "pending") {
    console.log("[Blueprint] Found pending, waiting:", topicHash);
    const ready = await waitForBlueprint(topicHash);
    if (!ready) {
      throw new Error("Blueprint wait failed");
    }
    return ready;
  }

  if (existing && existing.status === "failed") {
    // Retry failed blueprint
    console.log("[Blueprint] Retrying failed:", topicHash);
  }

  // 2. 使用 ON CONFLICT DO NOTHING 防止并发插入
  let pendingRecord: typeof topicBlueprints.$inferSelect | undefined;

  try {
    const inserted = await db
      .insert(topicBlueprints)
      .values({
        topic,
        topicHash,
        status: "pending",
        coreDimensions: [],
        modelUsed: "gemini-3-flash",
      })
      .onConflictDoNothing({
        target: topicBlueprints.topicHash,
      })
      .returning();

    pendingRecord = inserted[0];

    if (!pendingRecord) {
      // 另一个请求已经插入了，等待它完成
      console.log("[Blueprint] Concurrent insert detected, waiting:", topicHash);
      const ready = await waitForBlueprint(topicHash);
      if (!ready) {
        throw new Error("Blueprint wait failed after concurrent insert");
      }
      return ready;
    }
  } catch (insertError) {
    // 如果是唯一约束错误，说明另一个请求已经插入了
    console.log("[Blueprint] Insert conflict, waiting:", topicHash);
    const ready = await waitForBlueprint(topicHash);
    if (!ready) {
      throw new Error("Blueprint wait failed after insert error");
    }
    return ready;
  }

  console.log("[Blueprint] Created pending record:", topicHash);

  // 3. 生成蓝图
  try {
    const model = aiProvider.chatModel;

    const result = await generateObject({
      model,
      schema: BlueprintSchema,
      prompt: `我要为一个想学《${topic}》的用户做访谈。请生成一个打分权重的蓝图。

要求：
1. 列出 3-5 个核心评估维度
2. 每个维度有权重（总和100)
3. 提供关键词用于匹配用户提到的信息
4. 提供建议提问方向
注意：
- 维度应该是该主题特有的，不是通用的
- 例如学做菜需要"设备"、"口味"维度，学编程需要"语言基础"、"目标"维度
- 权重要精确，名称简洁明确`,
    });

    const dimensions: CoreDimension[] = result.object.coreDimensions.map((d) => ({
      name: d.name,
      keywords: d.keywords,
      weight: d.weight,
      suggestion: d.suggestion,
    }));

    // 4. 更新为 ready 状态
    const [readyRecord] = await db
      .update(topicBlueprints)
      .set({
        coreDimensions: dimensions,
        status: "ready",
        updatedAt: new Date(),
      })
      .where(eq(topicBlueprints.topicHash, topicHash))
      .returning();

    // 清除缓存，确保下次获取最新数据
    clearBlueprintCache(topic);

    if (!readyRecord) {
      throw new Error("Blueprint update failed - record not found");
    }

    console.log(
      "[Blueprint] Generated successfully:",
      topicHash,
      "with",
      dimensions.length,
      "dimensions",
    );
    return validateBlueprint(readyRecord);
  } catch (error) {
    console.error("[Blueprint] Generation failed:", error);
    // 更新为 failed 状态
    await db
      .update(topicBlueprints)
      .set({
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        updatedAt: new Date(),
      })
      .where(eq(topicBlueprints.topicHash, topicHash));

    // 清除缓存
    clearBlueprintCache(topic);
    throw error;
  }
}

/**
 * 触发异步蓝图生成（不等待结果）
 */
export function triggerBlueprintGeneration(topic: string): void {
  generateTopicBlueprint(topic).catch((error) => {
    console.error("[Blueprint] Async generation failed:", error);
  });
}

// ============================================
// Pending Facts Management (补丁 1: 冷启动竞态)
// ============================================

/**
 * 追加暂存事实（冷启动期）
 * 使用 SQL JSONB 数组追加，避免并发覆盖
 *
 * 【重要修复】使用 COALESCE 兜底 NULL 值
 * Postgres 中 NULL || jsonb 的结果是 NULL，必须初始化为空数组
 */
export async function appendPendingFacts(topic: string, facts: PendingFact[]): Promise<void> {
  if (!facts || facts.length === 0) return;

  const hash = hashTopic(topic);

  // 使用 COALESCE 确保 NULL 值被初始化为空数组
  // NULL || '[...]'::jsonb = NULL (错误!)
  // '[]'::jsonb || '[...]'::jsonb = '[...]' (正确!)
  await db
    .update(topicBlueprints)
    .set({
      pendingFacts: sql`COALESCE(${topicBlueprints.pendingFacts}, '[]'::jsonb) || ${JSON.stringify(facts)}::jsonb`,
      updatedAt: new Date(),
    })
    .where(eq(topicBlueprints.topicHash, hash));
}

/**
 * 获取并原子清除暂存事实
 * 使用事务确保读取和清除的原子性
 */
export async function getAndClearPendingFacts(topic: string): Promise<PendingFact[]> {
  const hash = hashTopic(topic);

  // 使用事务确保原子性
  const result = await db.transaction(async (tx) => {
    const blueprint = await tx.query.topicBlueprints.findFirst({
      where: (t, { eq }) => eq(t.topicHash, hash),
    });

    if (!blueprint || blueprint.status !== "ready") {
      return [];
    }

    const facts = (blueprint.pendingFacts as PendingFact[]) || [];

    if (facts && facts.length > 0) {
      // 在同一个事务中清除
      await tx
        .update(topicBlueprints)
        .set({
          pendingFacts: null,
          updatedAt: new Date(),
        })
        .where(eq(topicBlueprints.id, blueprint.id));
    }

    return facts;
  });

  return result;
}

/**
 * 蓝图生成完成时的回调处理
 * 当蓝图从 pending 变为 ready 时，触发重算
 *
 * 【重要修复】必须把重算的结果写回对应的 CourseProfile
 * 否则下次查询饱和度还是 0，导致重复提问
 */
export interface BlueprintReadyContext {
  /** 课程/会话 ID，用于写回评估结果 */
  courseId: string;
  /** 重新评估函数 */
  onReevaluate: (topic: string, facts: PendingFact[]) => SaturationEvaluation;
  /** 保存课程画像的回调（必须实现，否则状态丢失） */
  onSaveProfile: (courseId: string, updates: {
    extractedFacts: PendingFact[];
    saturationScore: number;
    nextHighValueDimensions: string[];
    blueprintStatus: "ready";
    blueprintId?: string;
  }) => Promise<void>;
}

export async function onBlueprintReady(
  topic: string,
  ctx: BlueprintReadyContext,
): Promise<void> {
  const pendingFacts = await getAndClearPendingFacts(topic);

  if (pendingFacts && pendingFacts.length > 0) {
    const blueprint = await getBlueprint(topic);

    if (blueprint) {
      // 1. 重新评估暂存的事实
      const evaluation = ctx.onReevaluate(topic, pendingFacts);

      // 2. 【核心修复】必须把重算的结果写回对应的 CourseProfile
      await ctx.onSaveProfile(ctx.courseId, {
        extractedFacts: pendingFacts,
        saturationScore: evaluation.score,
        nextHighValueDimensions: evaluation.missingDimensions,
        blueprintStatus: "ready",
        blueprintId: blueprint.id,
      });

      console.log(
        `[Blueprint] Course ${ctx.courseId} updated. Saturation: ${evaluation.score}, Facts: ${pendingFacts.length}`,
      );
    }
  }
}
