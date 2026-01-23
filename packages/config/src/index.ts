/**
 * @nexusnote/config
 *
 * Centralized configuration for NexusNote monorepo.
 * Single source of truth for all configuration values.
 */

import { z } from 'zod'

// ============================================
// Default Values
// ============================================

export const defaults = {
  // JWT Authentication
  jwt: {
    secret: 'nexusnote-dev-secret-change-in-production',
    expiresIn: '7d',
    issuer: 'nexusnote',
  },

  // RAG Pipeline
  rag: {
    timeout: 5000,
    retries: 2,
    similarityThreshold: 0.3,
    chunkSize: 500,
    chunkOverlap: 50,
    topK: 5,
  },

  // Embedding
  embedding: {
    model: 'Qwen/Qwen3-Embedding-8B',
    dimensions: 4000,
  },

  // Reranker
  reranker: {
    model: 'Qwen/Qwen3-Reranker-8B',
    enabled: false,
  },

  // Snapshot / Timeline
  snapshot: {
    intervalMs: 5 * 60 * 1000, // 5 minutes
    maxPerDocument: 100,
  },

  // Server
  server: {
    port: 3001,
    hocuspocusPort: 1234,
    corsOrigin: 'http://localhost:3000',
  },

  // Database
  database: {
    url: 'postgresql://postgres:postgres@localhost:5433/nexusnote',
  },

  // Redis
  redis: {
    url: 'redis://localhost:6380',
  },

  // AI Providers
  ai: {
    provider: 'deepseek' as const,
    providers: {
      deepseek: {
        baseURL: 'https://api.deepseek.com',
        chatModel: 'deepseek-chat',
        fastModel: 'deepseek-chat',
      },
      '302ai': {
        baseURL: 'https://api.302.ai/v1',
        chatModel: 'deepseek-chat',
        fastModel: 'deepseek-chat',
        supportsWebSearch: true,
      },
      siliconflow: {
        baseURL: 'https://api.siliconflow.cn/v1',
        chatModel: 'deepseek-ai/DeepSeek-V3',
        fastModel: 'Qwen/Qwen2.5-72B-Instruct',
      },
      openai: {
        baseURL: 'https://api.openai.com/v1',
        chatModel: 'gpt-4o',
        fastModel: 'gpt-4o-mini',
        embeddingModel: 'text-embedding-3-large',
        embeddingDimensions: 3072,
      },
    },
  },

  // Collaboration
  collaboration: {
    wsUrl: 'ws://localhost:1234',
  },

  // Queue
  queue: {
    ragConcurrency: 3,
    ragMaxRetries: 3,
    ragBackoffDelay: 1000,
  },
} as const

// ============================================
// Zod Schemas
// ============================================

/**
 * Server environment schema
 */
export const serverEnvSchema = z.object({
  // Database
  DATABASE_URL: z.string().url().default(defaults.database.url),

  // Redis
  REDIS_URL: z.string().default(defaults.redis.url),

  // Server
  PORT: z.coerce.number().int().positive().default(defaults.server.port),
  CORS_ORIGIN: z.string().default(defaults.server.corsOrigin),
  HOCUSPOCUS_PORT: z.coerce.number().int().positive().default(defaults.server.hocuspocusPort),

  // JWT Authentication
  JWT_SECRET: z.string().default(defaults.jwt.secret),
  JWT_EXPIRES_IN: z.string().default(defaults.jwt.expiresIn),
  JWT_ISSUER: z.string().default(defaults.jwt.issuer),

  // AI Provider Keys
  AI_302_API_KEY: z.string().optional(),
  DEEPSEEK_API_KEY: z.string().optional(),
  SILICONFLOW_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  AI_PROVIDER: z.enum(['deepseek', '302ai', 'siliconflow', 'openai']).optional(),

  // Embedding
  EMBEDDING_MODEL: z.string().default(defaults.embedding.model),
  EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().max(8192).default(defaults.embedding.dimensions),

  // Reranker
  RERANKER_MODEL: z.string().default(defaults.reranker.model),
  RERANKER_ENABLED: z.string().default('false').transform(v => v === 'true'),

  // RAG
  RAG_TIMEOUT: z.coerce.number().int().positive().default(defaults.rag.timeout),
  RAG_RETRIES: z.coerce.number().int().min(0).default(defaults.rag.retries),
  RAG_SIMILARITY_THRESHOLD: z.coerce.number().min(0).max(1).default(defaults.rag.similarityThreshold),
  RAG_CHUNK_SIZE: z.coerce.number().int().positive().default(defaults.rag.chunkSize),
  RAG_CHUNK_OVERLAP: z.coerce.number().int().min(0).default(defaults.rag.chunkOverlap),

  // Snapshot
  SNAPSHOT_INTERVAL_MS: z.coerce.number().int().positive().default(defaults.snapshot.intervalMs),
  SNAPSHOT_MAX_PER_DOC: z.coerce.number().int().positive().default(defaults.snapshot.maxPerDocument),

  // Queue
  QUEUE_RAG_CONCURRENCY: z.coerce.number().int().positive().default(defaults.queue.ragConcurrency),
  QUEUE_RAG_MAX_RETRIES: z.coerce.number().int().min(0).default(defaults.queue.ragMaxRetries),
  QUEUE_RAG_BACKOFF_DELAY: z.coerce.number().int().positive().default(defaults.queue.ragBackoffDelay),

  // Environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
})

export type ServerEnv = z.infer<typeof serverEnvSchema>

/**
 * Client environment schema (NEXT_PUBLIC_ variables)
 */
export const clientEnvSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().default('http://localhost:3001'),
  NEXT_PUBLIC_COLLAB_URL: z.string().default(defaults.collaboration.wsUrl),

  // Client-side AI keys (optional, for direct API calls)
  DEEPSEEK_API_KEY: z.string().optional(),
  AI_302_API_KEY: z.string().optional(),
  SILICONFLOW_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  AI_PROVIDER: z.enum(['deepseek', '302ai', 'siliconflow', 'openai']).optional(),

  // Embedding (client may need for dimensions)
  EMBEDDING_MODEL: z.string().default(defaults.embedding.model),
  EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(defaults.embedding.dimensions),
})

export type ClientEnv = z.infer<typeof clientEnvSchema>

// ============================================
// Parse Functions
// ============================================

/**
 * Parse and validate server environment
 */
export function parseServerEnv(env: NodeJS.ProcessEnv = process.env): ServerEnv {
  const result = serverEnvSchema.safeParse(env)

  if (!result.success) {
    console.error('❌ Server environment validation failed:')
    for (const issue of result.error.issues) {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`)
    }
    throw new Error('Invalid server environment configuration')
  }

  return result.data
}

/**
 * Parse and validate client environment
 */
export function parseClientEnv(env: Record<string, string | undefined> = {}): ClientEnv {
  // In browser, read from process.env (Next.js injects NEXT_PUBLIC_ vars)
  const merged = typeof window !== 'undefined'
    ? { ...process.env, ...env }
    : env

  const result = clientEnvSchema.safeParse(merged)

  if (!result.success) {
    console.error('❌ Client environment validation failed:')
    for (const issue of result.error.issues) {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`)
    }
    throw new Error('Invalid client environment configuration')
  }

  return result.data
}

// ============================================
// Runtime Config Builder
// ============================================

export interface RuntimeConfig {
  rag: {
    timeout: number
    retries: number
    similarityThreshold: number
    chunkSize: number
    chunkOverlap: number
    topK: number
  }
  embedding: {
    model: string
    dimensions: number
  }
  reranker: {
    model: string
    enabled: boolean
  }
  snapshot: {
    intervalMs: number
    maxPerDocument: number
  }
  queue: {
    ragConcurrency: number
    ragMaxRetries: number
    ragBackoffDelay: number
  }
}

/**
 * Build runtime config from environment
 */
export function buildRuntimeConfig(env: ServerEnv): RuntimeConfig {
  return {
    rag: {
      timeout: env.RAG_TIMEOUT,
      retries: env.RAG_RETRIES,
      similarityThreshold: env.RAG_SIMILARITY_THRESHOLD,
      chunkSize: env.RAG_CHUNK_SIZE,
      chunkOverlap: env.RAG_CHUNK_OVERLAP,
      topK: defaults.rag.topK,
    },
    embedding: {
      model: env.EMBEDDING_MODEL,
      dimensions: env.EMBEDDING_DIMENSIONS,
    },
    reranker: {
      model: env.RERANKER_MODEL,
      enabled: env.RERANKER_ENABLED,
    },
    snapshot: {
      intervalMs: env.SNAPSHOT_INTERVAL_MS,
      maxPerDocument: env.SNAPSHOT_MAX_PER_DOC,
    },
    queue: {
      ragConcurrency: env.QUEUE_RAG_CONCURRENCY,
      ragMaxRetries: env.QUEUE_RAG_MAX_RETRIES,
      ragBackoffDelay: env.QUEUE_RAG_BACKOFF_DELAY,
    },
  }
}

// ============================================
// Logging
// ============================================

/**
 * Log server config (hiding sensitive values)
 */
export function logServerConfig(env: ServerEnv): void {
  const maskSecret = (val: string | undefined) => val ? '***' : '(not set)'

  console.log('[Config] Server environment validated:')
  console.log(`  NODE_ENV: ${env.NODE_ENV}`)
  console.log(`  PORT: ${env.PORT}`)
  console.log(`  HOCUSPOCUS_PORT: ${env.HOCUSPOCUS_PORT}`)
  console.log(`  DATABASE_URL: ${env.DATABASE_URL.replace(/\/\/[^@]+@/, '//***@')}`)
  console.log(`  REDIS_URL: ${env.REDIS_URL}`)
  console.log(`  AI_302_API_KEY: ${maskSecret(env.AI_302_API_KEY)}`)
  console.log(`  DEEPSEEK_API_KEY: ${maskSecret(env.DEEPSEEK_API_KEY)}`)
  console.log(`  EMBEDDING_MODEL: ${env.EMBEDDING_MODEL}`)
  console.log(`  EMBEDDING_DIMENSIONS: ${env.EMBEDDING_DIMENSIONS}`)
  console.log(`  RERANKER_ENABLED: ${env.RERANKER_ENABLED}`)
  console.log(`  RAG_TIMEOUT: ${env.RAG_TIMEOUT}ms`)
  console.log(`  RAG_CHUNK_SIZE: ${env.RAG_CHUNK_SIZE}`)
}

// ============================================
// Re-exports for convenience
// ============================================

export { z } from 'zod'
