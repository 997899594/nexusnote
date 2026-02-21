/**
 * Circuit Breaker - 2026 Modern Implementation
 *
 * 保护 AI 服务调用的熔断器
 */

type CircuitState = "closed" | "open" | "half-open";

interface CircuitBreakerOptions {
  failureThreshold?: number;
  successThreshold?: number;
  timeout?: number;
  onOpen?: () => void;
  onClose?: () => void;
}

export class CircuitBreaker {
  private state: CircuitState = "closed";
  private failures = 0;
  private successes = 0;
  private nextAttempt = 0;
  private readonly failureThreshold: number;
  private readonly successThreshold: number;
  private readonly timeout: number;
  private readonly onOpen?: () => void;
  private readonly onClose?: () => void;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 5;
    this.successThreshold = options.successThreshold ?? 2;
    this.timeout = options.timeout ?? 30000;
    this.onOpen = options.onOpen;
    this.onClose = options.onClose;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "open") {
      if (Date.now() < this.nextAttempt) {
        throw new Error("Circuit breaker is open");
      }
      this.state = "half-open";
      this.successes = 0;
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    if (this.state === "half-open") {
      this.successes++;
      if (this.successes >= this.successThreshold) {
        this.state = "closed";
        this.onClose?.();
      }
    }
  }

  private onFailure(): void {
    this.failures++;
    if (this.failures >= this.failureThreshold) {
      this.state = "open";
      this.nextAttempt = Date.now() + this.timeout;
      this.onOpen?.();
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  reset(): void {
    this.state = "closed";
    this.failures = 0;
    this.successes = 0;
    this.nextAttempt = 0;
  }
}

export const aiCircuitBreaker = new CircuitBreaker({
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 30000,
  onOpen: () => console.warn("[CircuitBreaker] AI service circuit opened"),
  onClose: () => console.log("[CircuitBreaker] AI service circuit closed"),
});
