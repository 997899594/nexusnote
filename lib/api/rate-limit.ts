/**
 * Server-Side Rate Limiter
 *
 * Redis-backed implementation for distributed environments.
 * If Redis is temporarily unavailable, requests are allowed and an error is logged
 * instead of silently falling back to per-process memory state.
 */

import { getRedis } from "@/lib/redis";
import { serviceUnavailable, tooManyRequests } from "./errors";

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetInMs: number;
}

interface RateLimitOptions {
  failureMode?: "allow" | "deny";
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
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  try {
    const namespacedKey = `rate-limit:${key}`;
    const result = (await getRedis().eval(
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
    console.error("[RateLimit] Redis unavailable:", error);
    if (options.failureMode === "deny") {
      throw serviceUnavailable("请求保护服务暂时不可用，请稍后重试", "RATE_LIMIT_UNAVAILABLE");
    }

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
  options: RateLimitOptions = {},
): Promise<void> {
  const result = await checkRateLimit(key, limit, windowMs, options);
  if (result.allowed) {
    return;
  }

  throw tooManyRequests(errorMessage);
}
