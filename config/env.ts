/**
 * Centralized configuration for NexusNote.
 * Single source of truth for all configuration values.
 */

import { z } from "zod";

// ============================================
// Default Values
// ============================================

export const defaults = {
  observability: {
    appTraceLogs: false,
    learnDebugLogs: false,
  },

  // RAG Pipeline
  rag: {
    timeout: 5000,
    retries: 2,
    similarityThreshold: 0.3,
    chunkSize: 500,
    chunkOverlap: 50,
    topK: 5,
    debugLogs: false,
  },

  // Embedding
  embedding: {
    model: "Qwen/Qwen3-Embedding-8B",
    dimensions: 4096,
  },

  // Reranker
  reranker: {
    model: "Qwen/Qwen3-Reranker-4B",
    modelPro: "Qwen/Qwen3-Reranker-8B",
    enabled: false,
  },

  // AI Models (task-routed stack)
  ai: {
    modelInteractive: "qwen-plus-latest",
    modelOutline: "gpt-5.4-mini",
    modelSectionDraft: "qwen-plus-latest",
    modelExtract: "qwen-plus-latest",
    modelReview: "gpt-5.5",
    modelWebSearch: "gpt-5.4-mini",
    // 定价（USD / 1M tokens）。未知供应商通道默认 0，避免伪精确成本。
    priceInteractiveInputPer1M: 0,
    priceInteractiveOutputPer1M: 0,
    priceOutlineInputPer1M: 0.75,
    priceOutlineOutputPer1M: 4.5,
    priceSectionDraftInputPer1M: 0,
    priceSectionDraftOutputPer1M: 0,
    priceExtractInputPer1M: 0,
    priceExtractOutputPer1M: 0,
    priceReviewInputPer1M: 5,
    priceReviewOutputPer1M: 30,
    priceWebSearchInputPer1M: 0.75,
    priceWebSearchOutputPer1M: 4.5,
    // 默认关闭 provider 初始化噪音
    debugLogs: false,
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
  AUTH_RESEND_ENABLED: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  AUTH_DEV_LOGIN_ENABLED: z
    .string()
    .optional()
    .transform((v) => v === "true"),

  // AI Provider Keys (至少配置一个)
  AI_302_API_KEY: z.string().min(1),
  AI_302_BASE_URL: z.string().url().default(defaults.ai.baseURL),
  TAVILY_API_KEY: z.string().optional(),

  // AI Observability (可选 - Langfuse)
  LANGFUSE_PUBLIC_KEY: z.string().optional(),
  LANGFUSE_SECRET_KEY: z.string().optional(),

  // AI Models (task-routed defaults)
  AI_MODEL_INTERACTIVE: z.string().default(defaults.ai.modelInteractive),
  AI_MODEL_OUTLINE: z.string().default(defaults.ai.modelOutline),
  AI_MODEL_SECTION_DRAFT: z.string().default(defaults.ai.modelSectionDraft),
  AI_MODEL_EXTRACT: z.string().default(defaults.ai.modelExtract),
  AI_MODEL_REVIEW: z.string().default(defaults.ai.modelReview),
  AI_MODEL_WEB_SEARCH: z.string().default(defaults.ai.modelWebSearch),
  AI_MODEL_INTERACTIVE_PRICE_INPUT_PER_1M: z.coerce
    .number()
    .nonnegative()
    .default(defaults.ai.priceInteractiveInputPer1M),
  AI_MODEL_INTERACTIVE_PRICE_OUTPUT_PER_1M: z.coerce
    .number()
    .nonnegative()
    .default(defaults.ai.priceInteractiveOutputPer1M),
  AI_MODEL_OUTLINE_PRICE_INPUT_PER_1M: z.coerce
    .number()
    .nonnegative()
    .default(defaults.ai.priceOutlineInputPer1M),
  AI_MODEL_OUTLINE_PRICE_OUTPUT_PER_1M: z.coerce
    .number()
    .nonnegative()
    .default(defaults.ai.priceOutlineOutputPer1M),
  AI_MODEL_SECTION_DRAFT_PRICE_INPUT_PER_1M: z.coerce
    .number()
    .nonnegative()
    .default(defaults.ai.priceSectionDraftInputPer1M),
  AI_MODEL_SECTION_DRAFT_PRICE_OUTPUT_PER_1M: z.coerce
    .number()
    .nonnegative()
    .default(defaults.ai.priceSectionDraftOutputPer1M),
  AI_MODEL_EXTRACT_PRICE_INPUT_PER_1M: z.coerce
    .number()
    .nonnegative()
    .default(defaults.ai.priceExtractInputPer1M),
  AI_MODEL_EXTRACT_PRICE_OUTPUT_PER_1M: z.coerce
    .number()
    .nonnegative()
    .default(defaults.ai.priceExtractOutputPer1M),
  AI_MODEL_REVIEW_PRICE_INPUT_PER_1M: z.coerce
    .number()
    .nonnegative()
    .default(defaults.ai.priceReviewInputPer1M),
  AI_MODEL_REVIEW_PRICE_OUTPUT_PER_1M: z.coerce
    .number()
    .nonnegative()
    .default(defaults.ai.priceReviewOutputPer1M),
  AI_MODEL_WEB_SEARCH_PRICE_INPUT_PER_1M: z.coerce
    .number()
    .nonnegative()
    .default(defaults.ai.priceWebSearchInputPer1M),
  AI_MODEL_WEB_SEARCH_PRICE_OUTPUT_PER_1M: z.coerce
    .number()
    .nonnegative()
    .default(defaults.ai.priceWebSearchOutputPer1M),
  AI_DEBUG_LOGS: z
    .string()
    .default(String(defaults.ai.debugLogs))
    .transform((v) => v === "true"),
  APP_TRACE_LOGS: z
    .string()
    .default(String(defaults.observability.appTraceLogs))
    .transform((v) => v === "true"),
  LEARN_DEBUG_LOGS: z
    .string()
    .default(String(defaults.observability.learnDebugLogs))
    .transform((v) => v === "true"),

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
  RERANKER_MODEL_PRO: z.string().default(defaults.reranker.modelPro),
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
  RAG_DEBUG_LOGS: z
    .string()
    .default(String(defaults.rag.debugLogs))
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

  NEXT_PUBLIC_AUTH_RESEND_ENABLED: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  NEXT_PUBLIC_AUTH_DEV_LOGIN_ENABLED: z
    .string()
    .optional()
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

let cachedServerEnv: ServerEnv | null = null;
let cachedClientEnv: ClientEnv | null = null;

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

    if (!cachedServerEnv) {
      cachedServerEnv = parseServerEnv(process.env);
    }

    return Reflect.get(cachedServerEnv, prop);
  },
});

export const clientEnv = new Proxy({} as ClientEnv, {
  get(_target, prop) {
    if (typeof prop !== "string") return undefined;
    if (!cachedClientEnv) {
      cachedClientEnv = parseClientEnv();
    }
    return Reflect.get(cachedClientEnv, prop);
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
  console.log(`  AI_MODEL_INTERACTIVE: ${env.AI_MODEL_INTERACTIVE}`);
  console.log(`  AI_MODEL_OUTLINE: ${env.AI_MODEL_OUTLINE}`);
  console.log(`  AI_MODEL_SECTION_DRAFT: ${env.AI_MODEL_SECTION_DRAFT}`);
  console.log(`  AI_MODEL_EXTRACT: ${env.AI_MODEL_EXTRACT}`);
  console.log(`  AI_MODEL_REVIEW: ${env.AI_MODEL_REVIEW}`);
  console.log(`  AI_MODEL_WEB_SEARCH: ${env.AI_MODEL_WEB_SEARCH}`);
  console.log(`  AI_ENABLE_WEB_SEARCH: ${env.AI_ENABLE_WEB_SEARCH}`);
  console.log(`  EMBEDDING_MODEL: ${env.EMBEDDING_MODEL}`);
  console.log(`  EMBEDDING_DIMENSIONS: ${env.EMBEDDING_DIMENSIONS}`);
}

// ============================================
// Re-exports for convenience
// ============================================

export { z } from "zod";
