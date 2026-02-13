/**
 * AI Rate Limiting & Usage Tracking
 *
 * 使用 Redis 实现滑动窗口速率限制
 * 使用 PostgreSQL 记录 AI 使用量（成本追踪）
 */

import { env } from "@nexusnote/config";
import { aiUsage, and, db, eq, gte, sql } from "@nexusnote/db";
import IORedis from "ioredis";

// Redis 单例
let redis: IORedis | null = null;

function getRedis(): IORedis {
  if (!redis) {
    redis = new IORedis(env.REDIS_URL || "redis://localhost:6379", {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
  }
  return redis;
}

// 速率限制配置
const RATE_LIMITS = {
  // 每分钟请求数
  perMinute: 30,
  // 每小时请求数
  perHour: 200,
  // 每天请求数
  perDay: 1000,
} as const;

/**
 * 检查速率限制
 * 使用 Redis MULTI 实现原子操作
 */
export async function checkRateLimit(userId: string): Promise<{
  allowed: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
}> {
  const redis = getRedis();
  const now = Date.now();
  const minuteKey = `ratelimit:${userId}:minute:${Math.floor(now / 60000)}`;
  const hourKey = `ratelimit:${userId}:hour:${Math.floor(now / 3600000)}`;

  try {
    // 使用 pipeline 批量操作
    const pipeline = redis.pipeline();
    pipeline.incr(minuteKey);
    pipeline.expire(minuteKey, 60);
    pipeline.incr(hourKey);
    pipeline.expire(hourKey, 3600);

    const results = await pipeline.exec();

    const minuteCount = (results?.[0]?.[1] as number) || 0;
    const hourCount = (results?.[2]?.[1] as number) || 0;

    // 检查分钟限制
    if (minuteCount > RATE_LIMITS.perMinute) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: Math.ceil(now / 60000) * 60000,
        limit: RATE_LIMITS.perMinute,
      };
    }

    // 检查小时限制
    if (hourCount > RATE_LIMITS.perHour) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: Math.ceil(now / 3600000) * 3600000,
        limit: RATE_LIMITS.perHour,
      };
    }

    return {
      allowed: true,
      remaining: Math.min(RATE_LIMITS.perMinute - minuteCount, RATE_LIMITS.perHour - hourCount),
      resetAt: Math.ceil(now / 60000) * 60000,
      limit: RATE_LIMITS.perMinute,
    };
  } catch (error) {
    // Redis 故障时放行，避免阻塞用户
    console.error("[RateLimit] Redis error, allowing request:", error);
    return {
      allowed: true,
      remaining: RATE_LIMITS.perMinute,
      resetAt: now + 60000,
      limit: RATE_LIMITS.perMinute,
    };
  }
}

/**
 * 创建速率限制响应
 */
export function createRateLimitResponse(resetAt: number): Response {
  return new Response(
    JSON.stringify({
      error: "Rate limit exceeded",
      message: "请求过于频繁，请稍后再试",
      resetAt,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(Math.ceil((resetAt - Date.now()) / 1000)),
        "X-RateLimit-Reset": String(resetAt),
      },
    },
  );
}

// 模型成本配置（每百万 token，美分）
const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  // Gemini 3
  "gemini-3-flash-preview": { input: 7.5, output: 30 },
  "gemini-3-pro-preview": { input: 125, output: 500 },
  "gemini-3-flash-preview-web-search": { input: 7.5, output: 30 },
  // DeepSeek
  "deepseek-chat": { input: 14, output: 28 },
  "deepseek-reasoner": { input: 55, output: 219 },
  // 默认
  default: { input: 10, output: 40 },
};

/**
 * 计算成本（美分）
 */
function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const costs = MODEL_COSTS[model] || MODEL_COSTS.default;
  const inputCost = (inputTokens / 1_000_000) * costs.input;
  const outputCost = (outputTokens / 1_000_000) * costs.output;
  return Math.round((inputCost + outputCost) * 100); // 转为整数美分
}

// ============================================
// 异步使用量缓冲区（fire-and-forget，批量写入）
// ============================================

interface UsageRecord {
  userId: string;
  endpoint: string;
  intent?: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costCents: number;
  durationMs?: number;
  success: boolean;
  errorMessage?: string;
}

/** 缓冲区配置 */
const BUFFER_FLUSH_INTERVAL = 5_000; // 5 秒
const BUFFER_MAX_SIZE = 20; // 满 20 条立即刷新

let usageBuffer: UsageRecord[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;

/** 批量刷新缓冲区到数据库 */
async function flushUsageBuffer(): Promise<void> {
  if (usageBuffer.length === 0) return;

  const batch = usageBuffer;
  usageBuffer = [];

  try {
    await db.insert(aiUsage).values(batch);
  } catch (error) {
    console.error(`[AIUsage] 批量写入失败 (${batch.length} 条):`, error);
    // 写入失败不重试，避免内存泄漏
  }
}

/** 启动定时刷新（惰性初始化） */
function ensureFlushTimer(): void {
  if (flushTimer) return;
  flushTimer = setInterval(() => {
    void flushUsageBuffer();
  }, BUFFER_FLUSH_INTERVAL);
  // 不阻止进程退出
  if (flushTimer.unref) flushTimer.unref();
}

/**
 * 记录 AI 使用量（异步，fire-and-forget）
 *
 * 不阻塞请求路径。记录先写入内存缓冲区，
 * 定时或缓冲区满时批量 INSERT 到数据库。
 */
export function trackAIUsage(params: {
  userId: string;
  endpoint: string;
  intent?: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  durationMs?: number;
  success?: boolean;
  errorMessage?: string;
}): void {
  const {
    userId,
    endpoint,
    intent,
    model,
    inputTokens,
    outputTokens,
    durationMs,
    success = true,
    errorMessage,
  } = params;

  const totalTokens = inputTokens + outputTokens;
  const costCents = calculateCost(model, inputTokens, outputTokens);

  // 开发环境打印日志
  if (env.NODE_ENV === "development") {
    console.log(
      `[AIUsage] ${endpoint} | ${model} | ${totalTokens} tokens | $${(costCents / 100).toFixed(4)}`,
    );
  }

  // 写入缓冲区（零延迟）
  usageBuffer.push({
    userId,
    endpoint,
    intent,
    model,
    inputTokens,
    outputTokens,
    totalTokens,
    costCents,
    durationMs,
    success,
    errorMessage,
  });

  ensureFlushTimer();

  // 缓冲区满时立即刷新
  if (usageBuffer.length >= BUFFER_MAX_SIZE) {
    void flushUsageBuffer();
  }
}

/**
 * 获取用户今日使用量
 */
export async function getUserDailyUsage(userId: string): Promise<{
  totalTokens: number;
  totalCostCents: number;
  requestCount: number;
}> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const result = await db
    .select({
      totalTokens: sql<number>`COALESCE(SUM(${aiUsage.totalTokens}), 0)`,
      totalCostCents: sql<number>`COALESCE(SUM(${aiUsage.costCents}), 0)`,
      requestCount: sql<number>`COUNT(*)`,
    })
    .from(aiUsage)
    .where(and(eq(aiUsage.userId, userId), gte(aiUsage.createdAt, today)));

  return {
    totalTokens: Number(result[0]?.totalTokens) || 0,
    totalCostCents: Number(result[0]?.totalCostCents) || 0,
    requestCount: Number(result[0]?.requestCount) || 0,
  };
}
