/**
 * NexusNote Local-First Storage
 *
 * 本地优先架构的核心模块，提供：
 * - 离线完整可用的文档编辑
 * - Yjs CRDT 自动冲突解决
 * - 时间轴快照和版本恢复
 * - 可选的云端同步
 */

export * from "./document-store";
export { documentStore } from "./document-store";
export * from "./flashcard-store";
export { flashcardStore } from "./flashcard-store";
export * from "./learning-store";
export { learningStore } from "./learning-store";
export * from "./local-db";

// Re-export singletons for convenience
export { localDb } from "./local-db";
export * from "./snapshot-store";
export { snapshotStore } from "./snapshot-store";
export * from "./snapshot-sync";
export { snapshotSync } from "./snapshot-sync";
export * from "./sync-engine";
export { syncEngine } from "./sync-engine";
