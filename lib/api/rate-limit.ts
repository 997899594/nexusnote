/**
 * Server-Side Rate Limiter
 *
 * Redis-backed implementation for distributed environments.
 * If Redis is temporarily unavailable, fail-open callers use a bounded in-process
 * emergency limiter while fail-closed callers remain unavailable.
 */

import { buildErrorLogFields, writeStructuredLog } from "@/lib/observability/structured-log";
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

interface EmergencyRateLimitEntry {
  count: number;
  expiresAt: number;
}

const MAX_EMERGENCY_RATE_LIMIT_KEYS = 10_000;
const emergencyRateLimits = new Map<string, EmergencyRateLimitEntry>();

function pruneExpiredEmergencyLimits(now: number): void {
  for (const [key, entry] of emergencyRateLimits) {
    if (entry.expiresAt <= now) emergencyRateLimits.delete(key);
  }
}

function checkEmergencyRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  let entry = emergencyRateLimits.get(key);

  if (!entry || entry.expiresAt <= now) {
    if (emergencyRateLimits.size >= MAX_EMERGENCY_RATE_LIMIT_KEYS) {
      pruneExpiredEmergencyLimits(now);
    }
    if (emergencyRateLimits.size >= MAX_EMERGENCY_RATE_LIMIT_KEYS) {
      return { allowed: false, remaining: 0, resetInMs: windowMs };
    }
    entry = { count: 0, expiresAt: now + windowMs };
    emergencyRateLimits.set(key, entry);
  }

  entry.count += 1;
  return {
    allowed: entry.count <= limit,
    remaining: Math.max(0, limit - entry.count),
    resetInMs: Math.max(1, entry.expiresAt - now),
  };
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
    writeStructuredLog("warn", "rate_limit_redis_unavailable", buildErrorLogFields(error));
    if (options.failureMode === "deny") {
      throw serviceUnavailable("请求保护服务暂时不可用，请稍后重试", "RATE_LIMIT_UNAVAILABLE");
    }

    return checkEmergencyRateLimit(key, limit, windowMs);
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
