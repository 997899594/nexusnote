/**
 * Jotai Store - 统一状态管理
 *
 * 2026 架构师标准：使用 Jotai 作为唯一状态管理方案
 *
 * ## 架构原则
 * 1. 原子化状态 - 每个状态独立管理
 * 2. 组合优于嵌套 - 通过 derived atoms 组合状态
 * 3. 类型安全 - 完整的 TypeScript 支持
 * 4. 持久化支持 - atomWithStorage 用于需要持久化的状态
 *
 * ## 迁移计划
 * - NoteExtractionContext → hooks/use-note-extraction.ts ✅
 * - EditorContext → hooks/use-editor.ts
 * - useCourseGeneration → hooks/use-course-generation.ts
 */

// ============================================
// Auth State
// ============================================
export * from "./atoms/auth";

// ============================================
// Note Extraction State
// ============================================
export * from "./atoms/note-extraction";

// ============================================
// Editor State
// ============================================
export * from "./atoms/editor";

// ============================================
// Course Generation State
// ============================================
export * from "./atoms/course-generation";

// ============================================
// UI State
// ============================================
export * from "./atoms/ui";

// ============================================
// Hooks
// ============================================
export * from "./hooks/use-note-extraction";
export * from "./hooks/use-editor";
export * from "./hooks/use-course-generation";
export * from "./hooks/use-web-search-toggle";

// ============================================
// Re-export commonly used Jotai utilities
// ============================================
export { useAtom, useAtomValue, useSetAtom } from "jotai";
export { atomWithStorage, atomWithReset } from "jotai/utils";
