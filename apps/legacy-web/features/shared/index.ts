/**
 * shared 领域 — 跨领域共享模块
 *
 * 公共 API：只导出外部领域需要的接口
 */

// AI 基础设施
export {
  isAIConfigured,
  isEmbeddingConfigured,
  isWebSearchAvailable,
  registry,
} from "./ai/registry";
// 全局 Atoms
export * from "./atoms/auth";
export * from "./atoms/ui";
// 通用 Hooks
export { useToast } from "./hooks/use-toast";
// 本地存储基础层
export { localDb } from "./stores/local-db";

// 工具函数
export { cn } from "./utils";
