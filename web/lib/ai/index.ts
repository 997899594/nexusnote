/**
 * AI Module - Tools, Agents, Validation, Core
 * 扁平化自 ui/ai/
 */

// Core AI (CircuitBreaker, PromptRegistry, safeGenerateObject, aiProvider)
export { CircuitBreaker, PromptRegistry, safeGenerateObject, aiProvider } from './core';
export type { CircuitState, CircuitBreakerConfig, PromptTemplate } from './core';

// Tools
export * from './tools';

// Agents
export { getAgent } from './agents';

// Validation
export { sanitizeInput, validateRequest, MessageSchema, ChatRequestSchema } from './validation';
export type { ChatRequest, Intent } from './validation';
