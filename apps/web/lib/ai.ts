import { createOpenAI } from '@ai-sdk/openai'
import { LanguageModel, EmbeddingModel } from 'ai'

// ============================================
// 2026 现代化 AI 架构 - 多 Provider + Embedding
// ============================================

interface ProviderConfig {
  name: string
  baseURL: string
  apiKey: string
  models: {
    chat: string
    fast: string
  }
  // 302.ai 支持模型后缀扩展能力
  supportsWebSearch?: boolean
}

interface EmbeddingProviderConfig {
  name: string
  baseURL: string
  apiKey: string
  model: string
  dimensions: number
}

// ============================================
// Chat Provider 配置
// ============================================
function getConfiguredProviders(): ProviderConfig[] {
  const providers: ProviderConfig[] = []

  // DeepSeek 官方 - 主要 Chat Provider
  if (process.env.DEEPSEEK_API_KEY) {
    providers.push({
      name: 'deepseek',
      baseURL: 'https://api.deepseek.com',
      apiKey: process.env.DEEPSEEK_API_KEY,
      models: {
        chat: 'deepseek-chat',
        fast: 'deepseek-chat',
      },
    })
  }

  // 302.ai - 聚合平台（支持 -web-search 后缀联网）
  if (process.env.AI_302_API_KEY) {
    providers.push({
      name: '302ai',
      baseURL: 'https://api.302.ai/v1',
      apiKey: process.env.AI_302_API_KEY,
      models: {
        chat: 'deepseek-chat',
        fast: 'deepseek-chat',
      },
      supportsWebSearch: true, // 302.ai 支持 -web-search 后缀
    })
  }

  // 硅基流动
  if (process.env.SILICONFLOW_API_KEY) {
    providers.push({
      name: 'siliconflow',
      baseURL: 'https://api.siliconflow.cn/v1',
      apiKey: process.env.SILICONFLOW_API_KEY,
      models: {
        chat: 'deepseek-ai/DeepSeek-V3',
        fast: 'Qwen/Qwen2.5-72B-Instruct',
      },
    })
  }

  // OpenAI 官方
  if (process.env.OPENAI_API_KEY) {
    providers.push({
      name: 'openai',
      baseURL: 'https://api.openai.com/v1',
      apiKey: process.env.OPENAI_API_KEY,
      models: {
        chat: 'gpt-4o',
        fast: 'gpt-4o-mini',
      },
    })
  }

  return providers
}

// ============================================
// Embedding Provider 配置
// ============================================
function getEmbeddingProvider(): EmbeddingProviderConfig | null {
  // 优先使用 302.ai - Qwen3-Embedding-8B (MTEB #1, halfvec 4000维)
  if (process.env.AI_302_API_KEY) {
    return {
      name: '302ai',
      baseURL: 'https://api.302.ai/v1',
      apiKey: process.env.AI_302_API_KEY,
      model: process.env.EMBEDDING_MODEL || 'Qwen/Qwen3-Embedding-8B',
      dimensions: parseInt(process.env.EMBEDDING_DIMENSIONS || '4000'),
    }
  }

  // 备选：硅基流动
  if (process.env.SILICONFLOW_API_KEY) {
    return {
      name: 'siliconflow',
      baseURL: 'https://api.siliconflow.cn/v1',
      apiKey: process.env.SILICONFLOW_API_KEY,
      model: process.env.EMBEDDING_MODEL || 'Qwen/Qwen3-Embedding-8B',
      dimensions: parseInt(process.env.EMBEDDING_DIMENSIONS || '4096'),
    }
  }

  // 备选：OpenAI
  if (process.env.OPENAI_API_KEY) {
    return {
      name: 'openai',
      baseURL: 'https://api.openai.com/v1',
      apiKey: process.env.OPENAI_API_KEY,
      model: 'text-embedding-3-large',
      dimensions: 3072,
    }
  }

  return null
}

// ============================================
// Provider 选择逻辑
// ============================================
function getPrimaryProvider(): ProviderConfig | null {
  const providers = getConfiguredProviders()

  // 如果指定了 AI_PROVIDER，优先使用
  const preferredProvider = process.env.AI_PROVIDER
  if (preferredProvider) {
    const preferred = providers.find(p => p.name === preferredProvider)
    if (preferred) return preferred
  }

  return providers[0] || null
}

// ============================================
// 模型实例创建
// ============================================

// 创建 Chat 模型
function createChatModel(provider: ProviderConfig, modelType: 'chat' | 'fast'): LanguageModel {
  const openai = createOpenAI({
    baseURL: provider.baseURL,
    apiKey: provider.apiKey,
  })
  return openai.chat(provider.models[modelType])
}

// 创建 Embedding 模型 (AI SDK 6.x)
function createEmbeddingModel(config: EmbeddingProviderConfig): EmbeddingModel {
  const openai = createOpenAI({
    baseURL: config.baseURL,
    apiKey: config.apiKey,
  })
  // AI SDK 6.x: dimensions 需要在调用时指定，不在模型创建时
  return openai.embedding(config.model)
}

// ============================================
// 导出实例
// ============================================
const primaryProvider = getPrimaryProvider()
const embeddingConfig = getEmbeddingProvider()

// Chat 模型
export const chatModel = primaryProvider
  ? createChatModel(primaryProvider, 'chat')
  : null as unknown as LanguageModel

export const fastModel = primaryProvider
  ? createChatModel(primaryProvider, 'fast')
  : null as unknown as LanguageModel

// Embedding 模型 (AI SDK 6.x)
export const embeddingModel = embeddingConfig
  ? createEmbeddingModel(embeddingConfig)
  : null as unknown as EmbeddingModel

// ============================================
// 工具函数
// ============================================
export function isAIConfigured(): boolean {
  return primaryProvider !== null
}

export function isEmbeddingConfigured(): boolean {
  return embeddingConfig !== null
}

export function getAIProviderInfo() {
  return {
    chat: {
      provider: primaryProvider?.name || 'none',
      model: primaryProvider?.models.chat || 'none',
    },
    embedding: {
      provider: embeddingConfig?.name || 'none',
      model: embeddingConfig?.model || 'none',
      dimensions: embeddingConfig?.dimensions || 0,
    },
    configured: getConfiguredProviders().map(p => p.name),
  }
}

// Embedding 配置导出（供后端使用）
export function getEmbeddingConfig() {
  return embeddingConfig
}

// ============================================
// 联网搜索模型（302.ai 专属）
// ============================================

// 创建联网搜索版模型（自动添加 -web-search 后缀）
function createWebSearchModel(provider: ProviderConfig, modelType: 'chat' | 'fast'): LanguageModel | null {
  if (!provider.supportsWebSearch) return null

  const openai = createOpenAI({
    baseURL: provider.baseURL,
    apiKey: provider.apiKey,
  })
  const baseModel = provider.models[modelType]
  return openai.chat(`${baseModel}-web-search`)
}

// 联网搜索模型（需要 302.ai API Key）
export const webSearchModel = (() => {
  const provider = getConfiguredProviders().find(p => p.supportsWebSearch)
  return provider ? createWebSearchModel(provider, 'chat') : null
})()

// 检查是否支持联网搜索
export function isWebSearchAvailable(): boolean {
  return webSearchModel !== null
}

// ============================================
// 故障转移支持
// ============================================
export function getModelWithFallback(modelType: 'chat' | 'fast' = 'chat'): LanguageModel | null {
  const providers = getConfiguredProviders()
  if (providers.length === 0) return null
  return createChatModel(providers[0], modelType)
}

export function getAllModels(modelType: 'chat' | 'fast' = 'chat'): LanguageModel[] {
  return getConfiguredProviders().map(p => createChatModel(p, modelType))
}
