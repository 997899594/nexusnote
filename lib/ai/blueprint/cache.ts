/**
 * Blueprint Cache
 *
 * 内存缓存（LRU + TTL）+ 数据库回退
 */

import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { topicBlueprints } from "@/db/schema";
import type { CoreDimension, PendingFact, TopicBlueprint } from "@/types/interview";
import { hashTopic } from "./generator";

// ============================================
// Cache Configuration
// ============================================

const CACHE_MAX_SIZE = 500;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

interface CacheEntry {
  blueprint: TopicBlueprint;
  expiresAt: number;
}

// 内存缓存（带 TTL 的 LRU）
const cache = new Map<string, CacheEntry>();

/**
 * 清理过期缓存条目
 */
function cleanupExpired(): void {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (entry.expiresAt < now) {
      cache.delete(key);
    }
  }
}

/**
 * 获取缓存（带过期检查）
 */
function getFromCache(key: string): TopicBlueprint | null {
  const entry = cache.get(key);
  if (!entry) return null;

  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }

  return entry.blueprint;
}

/**
 * 设置缓存（带 LRU 淘汰）
 */
function setToCache(key: string, blueprint: TopicBlueprint): void {
  // LRU 淘汰：超过上限时删除最旧的条目
  if (cache.size >= CACHE_MAX_SIZE) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) {
      cache.delete(oldestKey);
    }
  }

  cache.set(key, {
    blueprint,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

// ============================================
// Type Validation
// ============================================

const BlueprintStatusSchema = z.enum(["pending", "ready", "failed"]);

/**
 * 验证并转换数据库记录
 */
function validateBlueprint(dbRecord: Record<string, unknown>): TopicBlueprint {
  const status = BlueprintStatusSchema.parse(dbRecord.status);

  // 验证 coreDimensions
  const coreDimensions: CoreDimension[] = Array.isArray(dbRecord.coreDimensions)
    ? dbRecord.coreDimensions.map((d: Record<string, unknown>) => ({
        name: String(d.name ?? ""),
        keywords: Array.isArray(d.keywords) ? d.keywords.map(String) : [],
        weight: typeof d.weight === "number" ? d.weight : 0,
        suggestion: String(d.suggestion ?? ""),
      }))
    : [];

  // 验证 pendingFacts
  let pendingFacts: PendingFact[] | null = null;
  if (dbRecord.pendingFacts !== null && Array.isArray(dbRecord.pendingFacts)) {
    pendingFacts = dbRecord.pendingFacts.map((f: Record<string, unknown>) => ({
      dimension: String(f.dimension ?? ""),
      value: f.value as string | number | boolean,
      type: (f.type as "string" | "number" | "boolean") || "string",
      confidence: typeof f.confidence === "number" ? f.confidence : 0.5,
      extractedAt: String(f.extractedAt ?? new Date().toISOString()),
      topicId: String(f.topicId ?? ""),
      isShared: Boolean(f.isShared),
    }));
  }

  return {
    id: String(dbRecord.id),
    topic: String(dbRecord.topic),
    topicHash: String(dbRecord.topicHash),
    coreDimensions,
    status,
    pendingFacts,
    modelUsed: String(dbRecord.modelUsed ?? "unknown"),
    errorMessage: typeof dbRecord.errorMessage === "string" ? dbRecord.errorMessage : null,
    createdAt: dbRecord.createdAt instanceof Date ? dbRecord.createdAt : null,
    updatedAt: dbRecord.updatedAt instanceof Date ? dbRecord.updatedAt : null,
  };
}

// ============================================
// Public API
// ============================================

/**
 * 获取蓝图（优先内存缓存，其次数据库）
 */
export async function getBlueprint(topic: string): Promise<TopicBlueprint | null> {
  const hash = hashTopic(topic);

  // 定期清理过期缓存
  if (cache.size > CACHE_MAX_SIZE / 2) {
    cleanupExpired();
  }

  // 1. 检查内存缓存
  const cached = getFromCache(hash);
  if (cached) {
    return cached;
  }

  // 2. 查询数据库
  const dbBlueprint = await db.query.topicBlueprints.findFirst({
    where: (t, { eq }) => eq(t.topicHash, hash),
  });

  if (!dbBlueprint) {
    return null;
  }

  // 3. 验证并缓存
  const blueprint = validateBlueprint(dbBlueprint as Record<string, unknown>);
  setToCache(hash, blueprint);

  return blueprint;
}

/**
 * 获取蓝图状态
 */
export async function getBlueprintState(
  topic: string,
): Promise<{ status: "pending" | "ready" | "failed" | null }> {
  const hash = hashTopic(topic);

  // 先检查缓存
  const cached = getFromCache(hash);
  if (cached) {
    return { status: cached.status };
  }

  const dbBlueprint = await db.query.topicBlueprints.findFirst({
    where: (t, { eq }) => eq(t.topicHash, hash),
  });

  if (!dbBlueprint) {
    return { status: null };
  }

  const status = BlueprintStatusSchema.safeParse(dbBlueprint.status);
  if (!status.success) {
    console.error("[Blueprint] Invalid status:", dbBlueprint.status);
    return { status: null };
  }

  return { status: status.data };
}

/**
 * 清除缓存
 */
export function clearBlueprintCache(topic?: string): void {
  if (topic) {
    const hash = hashTopic(topic);
    cache.delete(hash);
  } else {
    cache.clear();
  }
}
