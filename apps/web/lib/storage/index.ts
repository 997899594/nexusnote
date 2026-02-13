/**
 * NexusNote Local-First Storage
 *
 * 本地优先架构的核心模块
 * 文件已按领域重组：
 * - editor/stores/ — document-store, snapshot-store
 * - editor/sync/ — sync-engine, snapshot-sync, collaboration
 * - shared/stores/ — local-db
 * - learning/stores/ — flashcard-store, learning-store（待迁移）
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

// learning 领域（待迁移到 features/learning/stores/）
export * from "./flashcard-store";
export { flashcardStore } from "./flashcard-store";
export * from "./learning-store";
export { learningStore } from "./learning-store";
