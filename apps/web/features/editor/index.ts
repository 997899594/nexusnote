/**
 * editor 领域 — 文档编辑与协作
 *
 * 公共 API：只导出外部领域需要的接口
 */

// 组件
export { Editor } from "./components/Editor";
export { TimelinePanel } from "./components/timeline/TimelinePanel";

// 存储
export { documentStore } from "./stores/document-store";
export { snapshotStore } from "./stores/snapshot-store";

// 同步
export { syncEngine } from "./sync/sync-engine";
export { snapshotSync } from "./sync/snapshot-sync";

// Actions
export { getDocumentAction, updateDocumentAction } from "./actions/document";

// 核心工具
export { parseDocument } from "./core/document-parser";
export { smartConvert } from "./core/markdown";
