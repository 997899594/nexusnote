/**
 * Jotai Store — 按领域重组后的 barrel 导出
 *
 * 所有 atoms 和 hooks 已迁移到各自领域目录
 */

// Jotai 基础工具
export { useAtom, useAtomValue, useSetAtom } from "jotai";
export { atomWithReset, atomWithStorage } from "jotai/utils";
// chat 领域
export * from "@/features/chat/hooks/use-web-search-toggle";
// editor 领域
export * from "@/features/editor/atoms/editor";
export * from "@/features/editor/hooks/use-editor";
// learning 领域
export * from "@/features/learning/atoms/note-extraction";
export * from "@/features/learning/hooks/use-note-extraction";
// shared 领域
export * from "@/features/shared/atoms/auth";
export * from "@/features/shared/atoms/ui";
