/**
 * 熔断器（Circuit Breaker）
 *
 * 三态模型：
 * - closed（正常）：请求正常通过，失败时累计计数
 * - open（熔断）：跳过该 provider，直接 fallback 到下一个
 * - half-open（探测）：熔断超时后放一个请求试探，成功则恢复，失败则重新熔断
 */

export type CircuitState = "closed" | "open" | "half-open";

export interface CircuitBreakerConfig {
  /** 连续失败多少次后触发熔断 */
  failureThreshold: number;
  /** 熔断多久后进入 half-open 探测（毫秒） */
  resetTimeoutMs: number;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 3,
  resetTimeoutMs: 60_000,
};

export class CircuitBreaker {
  private state: CircuitState = "closed";
  private failures = 0;
  private lastFailureTime = 0;
  private config: CircuitBreakerConfig;

  readonly name: string;

  constructor(name: string, config?: Partial<CircuitBreakerConfig>) {
    this.name = name;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** 当前是否允许请求通过 */
  canExecute(): boolean {
    if (this.state === "closed") return true;

    if (this.state === "open") {
      const elapsed = Date.now() - this.lastFailureTime;
      if (elapsed >= this.config.resetTimeoutMs) {
        this.state = "half-open";
        return true;
      }
      return false;
    }

    // half-open：允许一个探测请求
    return true;
  }

  /** 记录成功 — 重置熔断器 */
  onSuccess(): void {
    this.failures = 0;
    this.state = "closed";
  }

  /** 记录失败 — 可能触发熔断 */
  onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.state === "half-open") {
      this.state = "open";
      return;
    }

    if (this.failures >= this.config.failureThreshold) {
      this.state = "open";
      console.warn(`[CircuitBreaker] ${this.name} 熔断：连续失败 ${this.failures} 次`);
    }
  }

  /** 获取当前状态（调试/监控用） */
  getStatus() {
    return {
      name: this.name,
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime,
    };
  }
}
