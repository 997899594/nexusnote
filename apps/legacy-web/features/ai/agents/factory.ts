/**
 * Agent Factory - Agent 工厂模式
 *
 * 2026 架构：统一的 Agent 创建入口，易于扩展
 */

import type { ToolLoopAgent } from "ai";
import { z } from "zod";
import { aiProvider } from "../provider";
import type { IntentType } from "../validation/request";

/**
 * Agent 上下文
 */
export interface AgentContext {
  userId: string;
  sessionId?: string;
  courseGenerationContext?: Record<string, unknown>;
  messages: Array<{
    role: "user" | "assistant" | "system";
    content: string | unknown[];
  }>;
}

/**
 * Agent 工厂函数类型
 */
type AgentFactory = (context: AgentContext) => ToolLoopAgent;

/**
 * Agent 注册表
 */
const AGENT_REGISTRY: Record<string, AgentFactory> = {};

/**
 * 注册 Agent
 */
export function registerAgent(name: string, factory: AgentFactory): void {
  AGENT_REGISTRY[name] = factory;
  console.log(`[Agent Factory] Registered agent: ${name}`);
}

/**
 * 获取 Agent
 */
export function getAgent(intent: IntentType, context: AgentContext): ToolLoopAgent {
  const factory = AGENT_REGISTRY[intent];

  if (!factory) {
    throw new Error(
      `Unknown intent: ${intent}. Available: ${Object.keys(AGENT_REGISTRY).join(", ")}`,
    );
  }

  return factory(context);
}

/**
 * 检查 Agent 是否已注册
 */
export function hasAgent(intent: IntentType): boolean {
  return intent in AGENT_REGISTRY;
}

/**
 * 获取所有已注册的 Agent
 */
export function getRegisteredAgents(): string[] {
  return Object.keys(AGENT_REGISTRY);
}

// ============================================
// 内置 Agent 导入和注册
// ============================================

/**
 * 延迟加载并注册所有 Agent
 * 避免循环依赖
 */
export async function registerAllAgents(): Promise<void> {
  // Chat Agent
  const { createChatAgent } = await import("@/features/ai/agents/chat-agent");
  registerAgent("CHAT", createChatAgent);
  registerAgent("EDITOR", createChatAgent); // 复用
  registerAgent("SEARCH", createChatAgent); // 复用

  // Interview Agent
  const { createInterviewAgent } = await import("@/features/ai/agents/interview-agent");
  registerAgent("INTERVIEW", createInterviewAgent);

  // Course Generation Agent
  const { createCourseGenerationAgent } = await import("@/features/ai/agents/course-agent");
  registerAgent("COURSE_GENERATION", createCourseGenerationAgent);

  console.log(`[Agent Factory] All agents registered: ${getRegisteredAgents().join(", ")}`);
}
