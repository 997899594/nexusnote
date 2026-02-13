/**
 * Error Handling Module
 *
 * 统一的错误处理系统
 */

// ============================================
// Convenience Re-exports
// ============================================
export type { ActionError, ActionResult, ActionSuccess } from "./handlers";

// ============================================
// Error Handlers
// ============================================
export * from "./handlers";
export {
  error,
  getToastConfig,
  handleActionError,
  logError,
  success,
  tryAction,
  unauthorizedError,
  validationError,
} from "./handlers";
// ============================================
// Error Types
// ============================================
export * from "./types";
