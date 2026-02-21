/**
 * Stores - Legacy Re-exports (使用新路径 @/features/*/stores)
 * @deprecated 使用 @/features/auth, @/features/ai, @/features/editor
 */

export { type ChatMessage, type ChatStatus, useAIChatStore } from "@/features/ai";
export { useAuthStore } from "@/features/auth";
export { type Document, useEditorStore } from "@/features/editor";
