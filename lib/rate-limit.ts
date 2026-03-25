/**
 * Server-Side Rate Limiter
 *
 * Redis-backed implementation for distributed environments.
 * If Redis is temporarily unavailable, requests are allowed and an error is logged
 * instead of silently falling back to per-process memory state.
 */

import { redis } from "@/lib/redis";

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetInMs: number;
}

const INCREMENT_WITH_TTL_SCRIPT = `
local current = redis.call("INCR", KEYS[1])
if current == 1 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
end

local ttl = redis.call("PTTL", KEYS[1])
if ttl < 0 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end

return { current, ttl }
`;

async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  try {
    const namespacedKey = `rate-limit:${key}`;
    const result = (await redis.eval(
      INCREMENT_WITH_TTL_SCRIPT,
      1,
      namespacedKey,
      windowMs.toString(),
    )) as [number | string, number | string];

    const count = Number(result[0] ?? 0);
    const ttl = Number(result[1] ?? windowMs);
    const remaining = Math.max(0, limit - count);

    return {
      allowed: count <= limit,
      remaining,
      resetInMs: ttl > 0 ? ttl : windowMs,
    };
  } catch (error) {
    console.error("[RateLimit] Redis unavailable, allowing request:", error);
    return {
      allowed: true,
      remaining: limit,
      resetInMs: windowMs,
    };
  }
}

/**
 * 检查速率限制，如果超限则抛出错误
 */
export async function checkRateLimitOrThrow(
  key: string,
  limit: number,
  windowMs: number,
  errorMessage = "请求过于频繁，请稍后再试",
): Promise<void> {
  const result = await checkRateLimit(key, limit, windowMs);
  if (result.allowed) {
    return;
  }

  const error = new Error(errorMessage) as Error & {
    statusCode: number;
    code: string;
    retryAfter: number;
  };
  error.statusCode = 429;
  error.code = "RATE_LIMITED";
  error.retryAfter = Math.ceil(result.resetInMs / 1000);
  throw error;
}
