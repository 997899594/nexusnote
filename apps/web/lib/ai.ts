/**
 * AI Configuration Module (2026 Modern Stack)
 *
 * 统一的 AI 模型配置，基于 Gemini 3 系列
 *
 * 模型分层：
 * - chatModel:      Gemini 3 Flash  - 通用任务（对话、快速生成）
 * - courseModel:    Gemini 3 Pro    - 长文本生成（课程内容）
 * - webSearchModel: Gemini 3 Flash+联网 - 需要最新知识（课程大纲）
 * - embeddingModel: Qwen3-Embedding - 向量化
 */

import { createOpenAI } from '@ai-sdk/openai'

// ============================================
// 环境变量读取
// ============================================
const AI_302_API_KEY = process.env.AI_302_API_KEY
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY
const OPENAI_API_KEY = process.env.OPENAI_API_KEY

// 模型配置（默认 Gemini 3 系列）
const AI_MODEL = process.env.AI_MODEL || 'gemini-3-flash-preview'
const AI_MODEL_PRO = process.env.AI_MODEL_PRO || 'gemini-3-pro-preview'
const AI_MODEL_WEB_SEARCH = process.env.AI_MODEL_WEB_SEARCH || 'gemini-3-flash-preview-web-search'
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'Qwen/Qwen3-Embedding-8B'
const EMBEDDING_DIMENSIONS = parseInt(process.env.EMBEDDING_DIMENSIONS || '4000')

// ============================================
// Provider 配置
// ============================================
function getProviderConfig(): { baseURL: string; apiKey: string; name: string } | null {
  // 302.ai 优先（支持所有模型）
  if (AI_302_API_KEY) {
    return {
      baseURL: 'https://api.302.ai/v1',
      apiKey: AI_302_API_KEY,
      name: '302.ai',
    }
  }

  // DeepSeek 备选
  if (DEEPSEEK_API_KEY) {
    return {
      baseURL: 'https://api.deepseek.com',
      apiKey: DEEPSEEK_API_KEY,
      name: 'deepseek',
    }
  }

  // OpenAI 备选
  if (OPENAI_API_KEY) {
    return {
      baseURL: 'https://api.openai.com/v1',
      apiKey: OPENAI_API_KEY,
      name: 'openai',
    }
  }

  return null
}

const providerConfig = getProviderConfig()
const openai = providerConfig
  ? createOpenAI({ baseURL: providerConfig.baseURL, apiKey: providerConfig.apiKey })
  : null

// ============================================
// 模型实例导出
// ============================================

/**
 * 通用模型 - Gemini 3 Flash
 * 用途：对话、问答、写作辅助、快速任务
 */
export const chatModel = openai?.chat(AI_MODEL) ?? null

/**
 * Pro 模型 - Gemini 3 Pro
 * 用途：课程内容生成、长文本、复杂任务
 */
export const courseModel = openai?.chat(AI_MODEL_PRO) ?? null

/**
 * 联网模型 - Gemini 3 Flash + Web Search
 * 用途：课程大纲（需要最新知识）、研究
 */
export const webSearchModel = openai?.chat(AI_MODEL_WEB_SEARCH) ?? null

/**
 * 快速模型 - 同 chatModel
 */
export const fastModel = chatModel

/**
 * Agent 模型 - 同 chatModel（Gemini 3 工具调用能力强）
 */
export const agentModel = chatModel

/**
 * Embedding 模型 - Qwen3-Embedding-8B
 */
export const embeddingModel = openai?.embedding(EMBEDDING_MODEL) ?? null

// ============================================
// 工具函数
// ============================================

export function isAIConfigured(): boolean {
  return providerConfig !== null
}

export function isEmbeddingConfigured(): boolean {
  return providerConfig !== null
}

export function isWebSearchAvailable(): boolean {
  // 302.ai 支持 -web-search 后缀
  return providerConfig?.name === '302.ai'
}

export function getAIProviderInfo() {
  return {
    provider: providerConfig?.name ?? 'none',
    models: {
      chat: AI_MODEL,
      pro: AI_MODEL_PRO,
      webSearch: AI_MODEL_WEB_SEARCH,
      embedding: EMBEDDING_MODEL,
    },
    embeddingDimensions: EMBEDDING_DIMENSIONS,
    configured: !!providerConfig,
  }
}

export function getEmbeddingConfig() {
  return {
    model: EMBEDDING_MODEL,
    dimensions: EMBEDDING_DIMENSIONS,
  }
}

// ============================================
// 日志（启动时打印）
// ============================================
if (typeof window === 'undefined' && providerConfig) {
  console.log('[AI] Provider:', providerConfig.name)
  console.log('[AI] Models:', { chat: AI_MODEL, pro: AI_MODEL_PRO, web: AI_MODEL_WEB_SEARCH })
}
