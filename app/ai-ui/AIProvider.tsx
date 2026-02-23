/**
 * AI Provider
 *
 * 使用 createAI 创建全局 AI 状态管理
 * 支持 Generative UI 的流式传输和消费
 */

import { createAI } from "@ai-sdk/rsc";
import { generateAIResponse } from "./actions";

// AI 状态类型
export interface AIState {
  messages: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
}

// UI 状态类型
export interface UIState {
  // 存储流式生成的 UI 组件
  components: Array<{
    id: string;
    component: React.ReactNode;
  }>;
}

// 初始状态
const initialAIState: AIState = {
  messages: [],
};

const initialUIState: UIState = {
  components: [],
};

// 创建 AI 实例
export const AI = createAI({
  actions: {
    generateAIResponse,
  },
  initialAIState,
  initialUIState,
});

/**
 * 获取当前 AI 状态的 Hook
 * (需要在 Server Component 中使用)
 */
export async function getAIState() {
  return initialAIState;
}

/**
 * 获取当前 UI 状态的 Hook
 */
export async function getUIState() {
  return initialUIState;
}
