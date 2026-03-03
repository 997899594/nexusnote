/**
 * AI Module - Tools, Agents, Validation, Core
 * 扁平化自 ui/ai/
 */

// Agents
export { getAgent } from "./agents";
// Core AI (aiProvider only)
export { aiProvider } from "./core";
// Tools
export * from "./tools";
export type { ChatRequest, Intent } from "./validation";
// Validation
export { ChatRequestSchema, validateRequest } from "./validation";
