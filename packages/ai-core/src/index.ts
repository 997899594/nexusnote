/**
 * @nexusnote/ai-core — AI 基础设施核心模块
 *
 * 框架无关的可复用 AI 构建块：
 * - CircuitBreaker: 三态熔断器（closed → open → half-open）
 * - PromptRegistry: 可版本化的 Prompt 模板管理
 * - safeGenerateObject: 带 schema 验证重试的结构化输出
 */

export { CircuitBreaker, type CircuitBreakerConfig, type CircuitState } from "./circuit-breaker.js";
export { PromptRegistry, type PromptTemplate } from "./prompt-registry.js";
export { safeGenerateObject, type SafeGenerateOptions } from "./safe-generate.js";
