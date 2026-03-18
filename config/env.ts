/**
 * Centralized configuration for NexusNote.
 * Single source of truth for all configuration values.
 */

import { z } from "zod";

// ============================================
// Default Values
// ============================================

export const defaults = {
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
    model: "Qwen/Qwen3-Embedding-8B",
    dimensions: 4000,
  },

  // Reranker
  reranker: {
    model: "Qwen/Qwen3-Reranker-8B",
    enabled: false,
  },

  // AI Models (2026 Modern Stack - Gemini 3)
  ai: {
    // 通用模型 - Gemini 3 Flash (速度快、成本低、推理强)
    model: "gemini-3-flash-preview",
    // Pro 模型 - Gemini 3 Pro (复杂任务)
    modelPro: "gemini-3-pro-preview",
    // 联网搜索模型
    modelWebSearch: "gemini-3-flash-preview-web-search",
    // 302.ai 为首选 Provider
    baseURL: "https://api.302.ai/v1",
  },

  // Notes / Liquid Knowledge
  notes: {
    topicThreshold: 0.25, // 语义聚类阈值
  },

  // Snapshot / Timeline
  snapshot: {
    intervalMs: 5 * 60 * 1000, // 5 minutes
    maxPerDocument: 100,
  },

  // Queue
  queue: {
    ragConcurrency: 3,
    ragMaxRetries: 3,
    ragBackoffDelay: 1000,
  },
} as const;

// ============================================
// Zod Schemas
// ============================================

/**
 * Server environment schema
 *
 * 必需变量：DATABASE_URL, REDIS_URL, AUTH_SECRET, 至少一个 AI Provider Key
 * 其余均有合理默认值，不写也能跑
 */
export const serverEnvSchema = z.object({
  // Database (必需)
  DATABASE_URL: z.string().url().describe("PostgreSQL Connection String"),

  // Redis (必需)
  REDIS_URL: z.string().describe("Redis Connection String"),

  // Auth.js v5 (session 签名，开发环境有默认值，生产必须自行配置)
  AUTH_SECRET: z.string().default("nexusnote-dev-secret-change-in-production"),

  // OAuth Providers (NextAuth)
  AUTH_GITHUB_ID: z.string().optional(),
  AUTH_GITHUB_SECRET: z.string().optional(),

  // Magic Link (Resend)
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),

  // AI Provider Keys (至少配置一个)
  AI_302_API_KEY: z.string().optional(),
  DEEPSEEK_API_KEY: z.string().optional(),
  SILICONFLOW_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  TAVILY_API_KEY: z.string().optional(),

  // AI Observability (可选 - Langfuse)
  LANGFUSE_PUBLIC_KEY: z.string().optional(),
  LANGFUSE_SECRET_KEY: z.string().optional(),

  // AI Models (有默认值)
  AI_MODEL: z.string().default(defaults.ai.model),
  AI_MODEL_PRO: z.string().default(defaults.ai.modelPro),
  AI_MODEL_WEB_SEARCH: z.string().default(defaults.ai.modelWebSearch),

  // AI Features
  AI_ENABLE_WEB_SEARCH: z
    .string()
    .default("false")
    .transform((v) => v === "true"),

  // Notes / Liquid Knowledge
  NOTES_TOPIC_THRESHOLD: z.coerce.number().min(0).max(1).default(defaults.notes.topicThreshold),

  // Embedding
  EMBEDDING_MODEL: z.string().default(defaults.embedding.model),
  EMBEDDING_DIMENSIONS: z.coerce
    .number()
    .int()
    .positive()
    .max(8192)
    .default(defaults.embedding.dimensions),

  // Reranker
  RERANKER_MODEL: z.string().default(defaults.reranker.model),
  RERANKER_ENABLED: z
    .string()
    .default("false")
    .transform((v) => v === "true"),

  // RAG
  RAG_TIMEOUT: z.coerce.number().int().positive().default(defaults.rag.timeout),
  RAG_RETRIES: z.coerce.number().int().min(0).default(defaults.rag.retries),
  RAG_SIMILARITY_THRESHOLD: z.coerce
    .number()
    .min(0)
    .max(1)
    .default(defaults.rag.similarityThreshold),
  RAG_CHUNK_SIZE: z.coerce.number().int().positive().default(defaults.rag.chunkSize),
  RAG_CHUNK_OVERLAP: z.coerce.number().int().min(0).default(defaults.rag.chunkOverlap),

  // RAG Advanced Features
  QUERY_REWRITING_ENABLED: z
    .string()
    .default("false")
    .transform((v) => v === "true"),
  HYBRID_SEARCH_ENABLED: z
    .string()
    .default("false")
    .transform((v) => v === "true"),
  CONTEXT_COMPRESSION_ENABLED: z
    .string()
    .default("false")
    .transform((v) => v === "true"),
  AI_FAST_MODEL: z.string().optional().describe("Fast model for query rewriting"),

  // Snapshot
  SNAPSHOT_INTERVAL_MS: z.coerce.number().int().positive().default(defaults.snapshot.intervalMs),
  SNAPSHOT_MAX_PER_DOC: z.coerce
    .number()
    .int()
    .positive()
    .default(defaults.snapshot.maxPerDocument),

  // Queue
  QUEUE_RAG_CONCURRENCY: z.coerce.number().int().positive().default(defaults.queue.ragConcurrency),
  QUEUE_RAG_MAX_RETRIES: z.coerce.number().int().min(0).default(defaults.queue.ragMaxRetries),
  QUEUE_RAG_BACKOFF_DELAY: z.coerce
    .number()
    .int()
    .positive()
    .default(defaults.queue.ragBackoffDelay),

  // Environment
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

/**
 * Client environment schema (NEXT_PUBLIC_ variables)
 */
export const clientEnvSchema = z.object({
  // AI Features (client can override via user preference)
  NEXT_PUBLIC_AI_ENABLE_WEB_SEARCH: z
    .string()
    .default("false")
    .transform((v) => v === "true"),

  // Environment
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;

// ============================================
// Parse Functions
// ============================================

/**
 * Parse and validate server environment
 */
export function parseServerEnv(env: NodeJS.ProcessEnv = process.env): ServerEnv {
  // Build-time check bypass for Next.js 16
  if (
    process.env.SKIP_ENV_VALIDATION === "true" ||
    process.env.NEXT_PHASE === "phase-production-build"
  ) {
    // Return partially valid data for build time
    return serverEnvSchema.partial().parse({}) as ServerEnv;
  }

  // Read from process.env for server-side
  const merged = { ...process.env, ...env };

  const result = serverEnvSchema.safeParse(merged);

  if (!result.success) {
    console.error("❌ Server environment validation failed:");
    for (const issue of result.error.issues) {
      console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
    }
    throw new Error("Invalid server environment configuration");
  }

  return result.data;
}

/**
 * Parse and validate client environment
 */
export function parseClientEnv(env: Record<string, string | undefined> = {}): ClientEnv {
  const processEnv = {
    NEXT_PUBLIC_AI_ENABLE_WEB_SEARCH: process.env.NEXT_PUBLIC_AI_ENABLE_WEB_SEARCH ?? "false",
    NODE_ENV: process.env.NODE_ENV,
  };

  const merged = { ...processEnv, ...env };

  const result = clientEnvSchema.safeParse(merged);

  if (!result.success) {
    console.error("❌ Client environment validation failed:");
    for (const issue of result.error.issues) {
      console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
    }
    throw new Error("Invalid client environment configuration");
  }

  return result.data;
}

export const env = new Proxy({} as ServerEnv, {
  get(_target, prop) {
    if (typeof prop !== "string") return undefined;

    // Ignore React internal props and Promise props to avoid noise
    if (
      prop === "$$typeof" ||
      prop === "then" ||
      prop === "toJSON" ||
      prop.startsWith("constructor")
    ) {
      return undefined;
    }

    // Prevent access on client side
    if (typeof window !== "undefined") {
      console.warn(`[config] Detected client-side access to server env var: ${prop}`);
      return undefined;
    }

    // Lazy initialization on first access
    const parsed = parseServerEnv(process.env);
    return Reflect.get(parsed, prop);
  },
});

export const clientEnv = new Proxy({} as ClientEnv, {
  get(_target, prop) {
    if (typeof prop !== "string") return undefined;
    const parsed = parseClientEnv();
    return Reflect.get(parsed, prop);
  },
});

// ============================================
// Logging
// ============================================

/**
 * Log server config (hiding sensitive values)
 */
export function logServerConfig(env: ServerEnv): void {
  const maskSecret = (val: string | undefined) => (val ? "***" : "(not set)");

  console.log("[Config] Server environment validated:");
  console.log(`  NODE_ENV: ${env.NODE_ENV}`);
  console.log(`  DATABASE_URL: ${env.DATABASE_URL.replace(/\/\/[^@]+@/, "//***@")}`);
  console.log(`  REDIS_URL: ${env.REDIS_URL}`);
  console.log(`  AI_302_API_KEY: ${maskSecret(env.AI_302_API_KEY)}`);
  console.log(`  AI_MODEL: ${env.AI_MODEL}`);
  console.log(`  AI_MODEL_PRO: ${env.AI_MODEL_PRO}`);
  console.log(`  AI_MODEL_WEB_SEARCH: ${env.AI_MODEL_WEB_SEARCH}`);
  console.log(`  AI_ENABLE_WEB_SEARCH: ${env.AI_ENABLE_WEB_SEARCH}`);
  console.log(`  EMBEDDING_MODEL: ${env.EMBEDDING_MODEL}`);
  console.log(`  EMBEDDING_DIMENSIONS: ${env.EMBEDDING_DIMENSIONS}`);
}

// ============================================
// Re-exports for convenience
// ============================================

export { z } from "zod";
