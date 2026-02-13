/**
 * NexusNote Local-First Storage — 按领域重组后的 barrel 导出
 *
 * 所有存储模块已迁移到各自领域目录：
 * - features/editor/stores/ — document-store, snapshot-store
 * - features/editor/sync/ — sync-engine, snapshot-sync, collaboration
 * - features/shared/stores/ — local-db
 * - features/learning/stores/ — flashcard-store, learning-store
 */

// editor 领域
export * from "@/features/editor/stores/document-store";
export { documentStore } from "@/features/editor/stores/document-store";
export * from "@/features/editor/stores/snapshot-store";
export { snapshotStore } from "@/features/editor/stores/snapshot-store";
export * from "@/features/editor/sync/snapshot-sync";
export { snapshotSync } from "@/features/editor/sync/snapshot-sync";
export * from "@/features/editor/sync/sync-engine";
export { syncEngine } from "@/features/editor/sync/sync-engine";

// shared 领域
export * from "@/features/shared/stores/local-db";
export { localDb } from "@/features/shared/stores/local-db";

// learning 领域
export * from "@/features/learning/stores/flashcard-store";
export { flashcardStore } from "@/features/learning/stores/flashcard-store";
export * from "@/features/learning/stores/learning-store";
export { learningStore } from "@/features/learning/stores/learning-store";
