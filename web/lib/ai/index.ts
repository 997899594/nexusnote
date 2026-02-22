/**
 * AI Module - Tools, Agents, Validation, Core
 * 扁平化自 ui/ai/
 */

// Agents
export { getAgent } from "./agents";
export type { CircuitBreakerConfig, CircuitState, PromptTemplate } from "./core";
// Core AI (CircuitBreaker, PromptRegistry, safeGenerateObject, aiProvider)
export { aiProvider, CircuitBreaker, PromptRegistry, safeGenerateObject } from "./core";
// Tools
export * from "./tools";
export type { ChatRequest, Intent } from "./validation";
// Validation
export { ChatRequestSchema, MessageSchema, sanitizeInput, validateRequest } from "./validation";
