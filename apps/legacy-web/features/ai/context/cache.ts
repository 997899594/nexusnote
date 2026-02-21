/**
 * Context Cache - 会话上下文缓存
 *
 * 2026 架构：减少数据库查询，提升性能
 */

interface CacheEntry<T> {
  value: T;
  timestamp: number;
  ttl: number;
}

export class ContextCache {
  private cache = new Map<string, CacheEntry<unknown>>();

  /**
   * 获取缓存值
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;

    if (!entry) return null;

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  /**
   * 设置缓存值
   */
  set<T>(key: string, value: T, ttlMs: number = 30000): void {
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl: ttlMs,
    });
  }

  /**
   * 删除缓存
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * 按模式删除缓存
   */
  invalidate(pattern: string): number {
    let count = 0;
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  /**
   * 清空所有缓存
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 获取缓存统计
   */
  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

/**
 * 全局缓存实例
 */
export const contextCache = new ContextCache();
