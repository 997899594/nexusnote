/**
 * Server AI Configuration Module (2026 Modern Stack)
 *
 * 后端统一 AI 配置，与前端保持一致
 * 支持多 Provider: 302.ai → DeepSeek → OpenAI
 */

import { createOpenAI, type OpenAIProvider } from '@ai-sdk/openai'
import { env, defaults } from '@nexusnote/config'

// ============================================
// 模型配置 (从验证过的 env 读取)
// ============================================
export const AI_MODEL = env.AI_MODEL
export const AI_MODEL_PRO = env.AI_MODEL_PRO
export const AI_MODEL_WEB_SEARCH = env.AI_MODEL_WEB_SEARCH
export const EMBEDDING_MODEL = env.EMBEDDING_MODEL

// ============================================
// Provider 配置 (与前端一致的多 Provider 支持)
// ============================================
function getProviderConfig(): { baseURL: string; apiKey: string; name: string } | null {
  // 302.ai 优先（支持所有模型）
  if (env.AI_302_API_KEY) {
    return {
      baseURL: 'https://api.302.ai/v1',
      apiKey: env.AI_302_API_KEY,
      name: '302.ai',
    }
  }

  // DeepSeek 备选
  if (env.DEEPSEEK_API_KEY) {
    return {
      baseURL: 'https://api.deepseek.com',
      apiKey: env.DEEPSEEK_API_KEY,
      name: 'deepseek',
    }
  }

  // OpenAI 备选
  if (env.OPENAI_API_KEY) {
    return {
      baseURL: 'https://api.openai.com/v1',
      apiKey: env.OPENAI_API_KEY,
      name: 'openai',
    }
  }

  return null
}

const providerConfig = getProviderConfig()

export const openai: OpenAIProvider | null = providerConfig
  ? createOpenAI({
      baseURL: providerConfig.baseURL,
      apiKey: providerConfig.apiKey,
    })
  : null

// ============================================
// 类型定义
// ============================================
type ChatModel = ReturnType<OpenAIProvider['chat']>
type EmbeddingModel = ReturnType<OpenAIProvider['embedding']>

// ============================================
// 模型获取函数 (带安全检查)
// ============================================

/** 通用模型 - Gemini 3 Flash */
export function getChatModel(): ChatModel {
  if (!openai) {
    throw new Error('[AI] Not configured - missing API key (AI_302_API_KEY, DEEPSEEK_API_KEY, or OPENAI_API_KEY)')
  }
  return openai.chat(AI_MODEL)
}

/** Pro 模型 - Gemini 3 Pro */
export function getCourseModel(): ChatModel {
  if (!openai) {
    throw new Error('[AI] Not configured - missing API key')
  }
  return openai.chat(AI_MODEL_PRO)
}

/** 联网搜索模型 */
export function getWebSearchModel(): ChatModel {
  if (!openai) {
    throw new Error('[AI] Not configured - missing API key')
  }
  return openai.chat(AI_MODEL_WEB_SEARCH)
}

/** 快速模型 - 同 Chat */
export function getFastModel(): ChatModel {
  return getChatModel()
}

/** Agent 模型 - 同 Chat */
export function getAgentModel(): ChatModel {
  return getChatModel()
}

/** Embedding 模型 */
export function getEmbeddingModel(): EmbeddingModel {
  if (!openai) {
    throw new Error('[AI] Not configured - missing API key')
  }
  return openai.embedding(EMBEDDING_MODEL)
}

// ============================================
// 工具函数
// ============================================
export function isAIConfigured(): boolean {
  return providerConfig !== null
}

export function getProviderName(): string {
  return providerConfig?.name ?? 'none'
}

export function logAIConfig(): void {
  console.log('[AI] Provider:', getProviderName())
  console.log('[AI] Chat Model:', AI_MODEL)
  console.log('[AI] Pro Model:', AI_MODEL_PRO)
  console.log('[AI] Web Search Model:', AI_MODEL_WEB_SEARCH)
  console.log('[AI] Embedding Model:', EMBEDDING_MODEL)
  console.log('[AI] Embedding Dimensions:', defaults.embedding.dimensions)
}
