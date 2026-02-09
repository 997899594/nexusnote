/**
 * Error Handling Module
 *
 * 统一的错误处理系统
 */

// ============================================
// Error Types
// ============================================
export * from "./types";

// ============================================
// Error Handlers
// ============================================
export * from "./handlers";

// ============================================
// Convenience Re-exports
// ============================================
export type { ActionResult, ActionSuccess, ActionError } from "./handlers";
export {
  success,
  error,
  validationError,
  unauthorizedError,
  handleActionError,
  tryAction,
  logError,
  getToastConfig,
} from "./handlers";
