/**
 * AI Agents — 按领域重组后的 barrel 导出
 */

// Chat Agent — 已迁移到 features/chat/agents/
export {
  type ChatAgentMessage,
  type ChatCallOptions,
  chatAgent,
} from "@/features/chat/agents/chat-agent";

// Interview Agent — 已迁移到 features/learning/agents/
export {
  type InterviewAgentMessage,
  type InterviewContext,
  interviewAgent,
} from "@/features/learning/agents/interview/agent";
