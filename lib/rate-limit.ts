/**
 * Server-Side Rate Limiter
 *
 * 内存实现，带自动清理过期条目
 * 注意：分布式环境应使用 Redis
 */

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

class RateLimiter {
  private limits = new Map<string, RateLimitRecord>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // 每分钟清理一次过期条目
    this.cleanupInterval = setInterval(() => this.cleanup(), 60 * 1000);
  }

  /**
   * 检查是否超过限制
   * @returns true 如果允许请求，false 如果被限制
   */
  check(key: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    const record = this.limits.get(key);

    // 没有记录或已过期，创建新记录
    if (!record || record.resetAt < now) {
      this.limits.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }

    // 检查是否超限
    if (record.count >= limit) {
      return false;
    }

    // 增加计数
    record.count++;
    return true;
  }

  /**
   * 获取剩余请求次数
   */
  remaining(key: string, limit: number): number {
    const record = this.limits.get(key);
    if (!record || record.resetAt < Date.now()) {
      return limit;
    }
    return Math.max(0, limit - record.count);
  }

  /**
   * 获取重置时间（毫秒）
   */
  resetIn(key: string): number | null {
    const record = this.limits.get(key);
    if (!record) return null;
    const remaining = record.resetAt - Date.now();
    return remaining > 0 ? remaining : null;
  }

  /**
   * 清理过期条目
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.limits) {
      if (record.resetAt < now) {
        this.limits.delete(key);
      }
    }
  }

  /**
   * 销毁清理定时器（测试用）
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// 单例实例
export const rateLimiter = new RateLimiter();

/**
 * 检查速率限制，如果超限则抛出错误
 */
export function checkRateLimitOrThrow(
  key: string,
  limit: number,
  windowMs: number,
  errorMessage = "请求过于频繁，请稍后再试",
): void {
  if (!rateLimiter.check(key, limit, windowMs)) {
    const resetIn = rateLimiter.resetIn(key);
    const retryAfter = resetIn ? Math.ceil(resetIn / 1000) : 60;
    const error = new Error(errorMessage) as Error & { statusCode: number; code: string };
    error.statusCode = 429;
    error.code = "RATE_LIMITED";
    throw error;
  }
}
