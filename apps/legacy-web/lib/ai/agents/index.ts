/**
 * AI Agents — 按领域重组后的 barrel 导出
 */

// Chat Agent — 已迁移到 features/chat/agents/
export {
  type ChatAgentMessage,
  type ChatCallOptions,
  chatAgent,
} from "@/features/chat/agents/chat-agent";

// Interview Agent — 工厂函数，不再是单例
export {
  createInterviewAgent,
  type InterviewAgentMessage,
  type InterviewCallOptions,
} from "@/features/learning/agent/interview-agent";
