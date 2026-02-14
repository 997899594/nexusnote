/**
 * editor 领域 — 文档编辑与协作
 *
 * 公共 API：只导出外部领域需要的接口
 */

// Actions
export { getDocumentAction, updateDocumentAction } from "./actions/document";
// 组件
export { Editor } from "./components/Editor";
export { TimelinePanel } from "./components/timeline/TimelinePanel";
// 核心工具
export { parseDocument } from "./core/document-parser";
export { smartConvert } from "./core/markdown";
// Hooks
export { useEditorToolGuard } from "./hooks/useEditorToolGuard";
export { type AIAction, useInlineAI } from "./hooks/useInlineAI";
// 存储
export { documentStore } from "./stores/document-store";
export { snapshotStore } from "./stores/snapshot-store";
export { snapshotSync } from "./sync/snapshot-sync";
// 同步
export { syncEngine } from "./sync/sync-engine";
