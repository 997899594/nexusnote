/**
 * chat 领域 — AI 对话、知识问答、工具调用
 *
 * 公共 API：只导出外部领域需要的接口
 */

// Agent
export { chatAgent } from "./agents/chat-agent";
export { ChatSidebar } from "./components/ai/ChatSidebar";
export { KnowledgePanel } from "./components/ai/KnowledgePanel";
// 组件
export { UnifiedChatUI } from "./components/ai/UnifiedChatUI";
// Hooks
export { useWebSearchToggle } from "./hooks/use-web-search-toggle";
// Tools
export * from "./tools/chat";
