/**
 * Centralized configuration for NexusNote.
 * Single source of truth for all configuration values.
 */

import { z } from "zod";
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL } from "./embedding";

const DEVELOPMENT_AUTH_SECRET = "nexusnote-dev-secret-change-in-production";

// ============================================
// Default Values
// ============================================

export const defaults = {
  observability: {
    appTraceLogs: false,
    learnDebugLogs: false,
  },

  productAnalytics: {
    posthogHost: "https://us.i.posthog.com",
  },

  freeChatGovernor: {
    economyDailyTokens: 100_000,
    compactDailyTokens: 300_000,
    standardContextMessages: 24,
    economyContextMessages: 12,
    compactContextMessages: 6,
    standardContextTokens: 80_000,
    economyContextTokens: 48_000,
    compactContextTokens: 32_000,
  },

  conversationInput: {
    maxRequestBytes: 512_000,
    maxMessages: 80,
    maxPartsPerMessage: 32,
    maxTextPartCharacters: 24_000,
    maxEstimatedTokens: 120_000,
  },

  operations: {
    outboxMaxPendingAgeSeconds: 120,
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
    contextCompressionEnabled: true,
  },

  // Embedding
  embedding: {
    model: EMBEDDING_MODEL,
    dimensions: EMBEDDING_DIMENSIONS,
  },

  // Reranker
  reranker: {
    model: "qwen3-rerank",
    modelPro: "qwen3-rerank",
    enabled: true,
  },

  // AI Models (task-routed stack)
  ai: {
    qwenModelInteractive: "qwen3.6-plus",
    qwenModelEconomy: "qwen3.6-flash",
    qwenModelOutline: "qwen3.7-max",
    qwenModelSectionDraft: "qwen3.6-plus",
    qwenModelExtract: "qwen3.6-flash",
    qwenModelReview: "qwen3.7-max",
    qwenModelWebSearch: "qwen3.6-plus",
    deepseekModelInteractive: "deepseek-v4-flash",
    deepseekModelEconomy: "deepseek-chat",
    deepseekModelOutline: "deepseek-v4-pro",
    deepseekModelSectionDraft: "deepseek-v4-flash",
    deepseekModelExtract: "deepseek-v4-flash",
    deepseekModelReview: "deepseek-v4-pro",
    deepseekModelWebSearch: "deepseek-v4-flash",
    openaiModelInteractive: "gpt-5.5",
    openaiModelEconomy: "gpt-5-mini",
    openaiModelOutline: "gpt-5.5",
    openaiModelSectionDraft: "gpt-5.5",
    openaiModelExtract: "gpt-5.5",
    openaiModelReview: "gpt-5.5",
    openaiModelWebSearch: "gpt-5.5",
    // Optional JSON object keyed by concrete model id:
    // {"qwen3.6-plus":{"input":0.3,"output":1.2}}
    modelPricingJson: "{}",
    modelPricingVersion: "unversioned",
    // 默认关闭 AI 初始化噪音
    debugLogs: false,
    baseURL: "https://api.302ai.cn/v1",
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
    learningOutboxConcurrency: 2,
    learningOutboxMaxRetries: 5,
    learningOutboxBackoffDelay: 1000,
    analyticsOutboxConcurrency: 4,
    analyticsOutboxMaxRetries: 5,
    analyticsOutboxBackoffDelay: 1000,
    courseProductionConcurrency: 1,
    courseProductionMaxRetries: 2,
    courseProductionBackoffDelay: 1500,
    careerTreeConcurrency: 1,
    careerTreeMaxRetries: 3,
    careerTreeBackoffDelay: 1000,
    knowledgeInsightsConcurrency: 1,
    knowledgeInsightsMaxRetries: 3,
    knowledgeInsightsBackoffDelay: 1000,
    noteFollowupsConcurrency: 2,
    noteFollowupsMaxRetries: 3,
    noteFollowupsBackoffDelay: 1000,
    ragConcurrency: 3,
    ragMaxRetries: 3,
    ragBackoffDelay: 1000,
    researchConcurrency: 2,
    researchMaxRetries: 2,
    researchBackoffDelay: 1500,
  },

  billing: {
    provider: "external",
    checkoutBaseUrl: "",
    webhookSecret: "",
    pay302BaseUrl: "https://api.302.ai",
    pay302ApiKey: "",
  },
} as const;

// ============================================
// Zod Schemas
// ============================================

/**
 * Server environment schema
 *
 * 必需变量：DATABASE_URL, REDIS_URL, AUTH_SECRET, AI gateway key
 * 其余均有合理默认值，不写也能跑
 */
const serverEnvSchema = z.object({
  // Database (必需)
  DATABASE_URL: z.string().url().describe("PostgreSQL Connection String"),

  // Redis (必需)
  REDIS_URL: z.string().describe("Redis Connection String"),

  // Auth.js v5 (session 签名，开发环境有默认值，生产必须自行配置)
  AUTH_SECRET: z.string().min(32).default(DEVELOPMENT_AUTH_SECRET),

  // Magic Link (Resend)
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  AUTH_RESEND_ENABLED: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  APP_BASE_URL: z.string().url().optional(),

  // AI gateway
  AI_302_API_KEY: z.string().min(1),
  AI_302_BASE_URL: z.string().url().default(defaults.ai.baseURL),
  TAVILY_API_KEY: z.string().optional(),
  EXA_API_KEY: z.string().optional(),
  FIRECRAWL_API_KEY: z.string().optional(),
  JINA_API_KEY: z.string().optional(),

  // Product analytics is an optional projection; PostgreSQL remains authoritative.
  POSTHOG_PROJECT_KEY: z.string().min(1).optional(),
  POSTHOG_HOST: z.string().url().default(defaults.productAnalytics.posthogHost),
  // Telemetry export is capability-driven. The runtime stays healthy when no collector is bound.
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
  OTEL_EXPORTER_OTLP_METRICS_ENDPOINT: z.string().url().optional(),

  // AI Models (task-routed defaults)
  AI_QWEN_MODEL_INTERACTIVE: z.string().default(defaults.ai.qwenModelInteractive),
  AI_QWEN_MODEL_ECONOMY: z.string().default(defaults.ai.qwenModelEconomy),
  AI_QWEN_MODEL_OUTLINE: z.string().default(defaults.ai.qwenModelOutline),
  AI_QWEN_MODEL_SECTION_DRAFT: z.string().default(defaults.ai.qwenModelSectionDraft),
  AI_QWEN_MODEL_EXTRACT: z.string().default(defaults.ai.qwenModelExtract),
  AI_QWEN_MODEL_REVIEW: z.string().default(defaults.ai.qwenModelReview),
  AI_QWEN_MODEL_WEB_SEARCH: z.string().default(defaults.ai.qwenModelWebSearch),
  AI_DEEPSEEK_MODEL_INTERACTIVE: z.string().default(defaults.ai.deepseekModelInteractive),
  AI_DEEPSEEK_MODEL_ECONOMY: z.string().default(defaults.ai.deepseekModelEconomy),
  AI_DEEPSEEK_MODEL_OUTLINE: z.string().default(defaults.ai.deepseekModelOutline),
  AI_DEEPSEEK_MODEL_SECTION_DRAFT: z.string().default(defaults.ai.deepseekModelSectionDraft),
  AI_DEEPSEEK_MODEL_EXTRACT: z.string().default(defaults.ai.deepseekModelExtract),
  AI_DEEPSEEK_MODEL_REVIEW: z.string().default(defaults.ai.deepseekModelReview),
  AI_DEEPSEEK_MODEL_WEB_SEARCH: z.string().default(defaults.ai.deepseekModelWebSearch),
  AI_OPENAI_MODEL_INTERACTIVE: z.string().default(defaults.ai.openaiModelInteractive),
  AI_OPENAI_MODEL_ECONOMY: z.string().default(defaults.ai.openaiModelEconomy),
  AI_OPENAI_MODEL_OUTLINE: z.string().default(defaults.ai.openaiModelOutline),
  AI_OPENAI_MODEL_SECTION_DRAFT: z.string().default(defaults.ai.openaiModelSectionDraft),
  AI_OPENAI_MODEL_EXTRACT: z.string().default(defaults.ai.openaiModelExtract),
  AI_OPENAI_MODEL_REVIEW: z.string().default(defaults.ai.openaiModelReview),
  AI_OPENAI_MODEL_WEB_SEARCH: z.string().default(defaults.ai.openaiModelWebSearch),
  AI_MODEL_PRICING_JSON: z
    .string()
    .default(defaults.ai.modelPricingJson)
    .transform((value, ctx) => {
      try {
        return z
          .record(
            z.string().min(1),
            z.object({
              input: z.coerce.number().nonnegative(),
              output: z.coerce.number().nonnegative(),
            }),
          )
          .parse(JSON.parse(value));
      } catch {
        ctx.addIssue({
          code: "custom",
          message:
            'AI_MODEL_PRICING_JSON must be a JSON object like {"model-id":{"input":0,"output":0}}',
        });
        return z.NEVER;
      }
    }),
  AI_MODEL_PRICING_VERSION: z.string().min(1).default(defaults.ai.modelPricingVersion),
  AI_DEBUG_LOGS: z
    .string()
    .default(String(defaults.ai.debugLogs))
    .transform((v) => v === "true"),
  FREE_CHAT_ECONOMY_DAILY_TOKENS: z.coerce
    .number()
    .int()
    .positive()
    .default(defaults.freeChatGovernor.economyDailyTokens),
  FREE_CHAT_COMPACT_DAILY_TOKENS: z.coerce
    .number()
    .int()
    .positive()
    .default(defaults.freeChatGovernor.compactDailyTokens),
  FREE_CHAT_STANDARD_CONTEXT_MESSAGES: z.coerce
    .number()
    .int()
    .positive()
    .default(defaults.freeChatGovernor.standardContextMessages),
  FREE_CHAT_ECONOMY_CONTEXT_MESSAGES: z.coerce
    .number()
    .int()
    .positive()
    .default(defaults.freeChatGovernor.economyContextMessages),
  FREE_CHAT_COMPACT_CONTEXT_MESSAGES: z.coerce
    .number()
    .int()
    .positive()
    .default(defaults.freeChatGovernor.compactContextMessages),
  FREE_CHAT_STANDARD_CONTEXT_TOKENS: z.coerce
    .number()
    .int()
    .positive()
    .default(defaults.freeChatGovernor.standardContextTokens),
  FREE_CHAT_ECONOMY_CONTEXT_TOKENS: z.coerce
    .number()
    .int()
    .positive()
    .default(defaults.freeChatGovernor.economyContextTokens),
  FREE_CHAT_COMPACT_CONTEXT_TOKENS: z.coerce
    .number()
    .int()
    .positive()
    .default(defaults.freeChatGovernor.compactContextTokens),
  AI_CONVERSATION_MAX_REQUEST_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(defaults.conversationInput.maxRequestBytes),
  AI_CONVERSATION_MAX_MESSAGES: z.coerce
    .number()
    .int()
    .positive()
    .default(defaults.conversationInput.maxMessages),
  AI_CONVERSATION_MAX_PARTS_PER_MESSAGE: z.coerce
    .number()
    .int()
    .positive()
    .default(defaults.conversationInput.maxPartsPerMessage),
  AI_CONVERSATION_MAX_TEXT_PART_CHARACTERS: z.coerce
    .number()
    .int()
    .positive()
    .default(defaults.conversationInput.maxTextPartCharacters),
  AI_CONVERSATION_MAX_ESTIMATED_TOKENS: z.coerce
    .number()
    .int()
    .positive()
    .default(defaults.conversationInput.maxEstimatedTokens),
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
    .default("true")
    .transform((v) => v === "true"),

  // Billing
  BILLING_PROVIDER: z.enum(["external", "302pay", "payjs"]).default(defaults.billing.provider),
  BILLING_CHECKOUT_BASE_URL: z.string().default(defaults.billing.checkoutBaseUrl),
  BILLING_WEBHOOK_SECRET: z.string().default(defaults.billing.webhookSecret),
  BILLING_302PAY_BASE_URL: z.string().url().default(defaults.billing.pay302BaseUrl),
  BILLING_302PAY_API_KEY: z.string().default(defaults.billing.pay302ApiKey),
  BILLING_PAYJS_MCH_ID: z.string().optional(),
  BILLING_PAYJS_KEY: z.string().optional(),

  // Notes / Liquid Knowledge
  NOTES_TOPIC_THRESHOLD: z.coerce.number().min(0).max(1).default(defaults.notes.topicThreshold),

  // Embedding
  EMBEDDING_MODEL: z.string().default(defaults.embedding.model),
  // Database schema owns the vector width. Changing this requires an explicit schema migration.
  EMBEDDING_DIMENSIONS: z.coerce
    .number()
    .int()
    .default(defaults.embedding.dimensions)
    .refine((value) => value === defaults.embedding.dimensions, {
      message: `EMBEDDING_DIMENSIONS must match database vector(${defaults.embedding.dimensions})`,
    }),

  // Reranker
  RERANKER_MODEL: z.string().default(defaults.reranker.model),
  RERANKER_MODEL_PRO: z.string().default(defaults.reranker.modelPro),
  RERANKER_ENABLED: z
    .string()
    .default(String(defaults.reranker.enabled))
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
    .default(String(defaults.rag.contextCompressionEnabled))
    .transform((v) => v === "true"),
  RAG_DEBUG_LOGS: z
    .string()
    .default(String(defaults.rag.debugLogs))
    .transform((v) => v === "true"),

  // Snapshot
  SNAPSHOT_INTERVAL_MS: z.coerce.number().int().positive().default(defaults.snapshot.intervalMs),
  SNAPSHOT_MAX_PER_DOC: z.coerce
    .number()
    .int()
    .positive()
    .default(defaults.snapshot.maxPerDocument),

  // Queue
  QUEUE_LEARNING_OUTBOX_CONCURRENCY: z.coerce
    .number()
    .int()
    .positive()
    .default(defaults.queue.learningOutboxConcurrency),
  QUEUE_LEARNING_OUTBOX_MAX_RETRIES: z.coerce
    .number()
    .int()
    .positive()
    .default(defaults.queue.learningOutboxMaxRetries),
  QUEUE_LEARNING_OUTBOX_BACKOFF_DELAY: z.coerce
    .number()
    .int()
    .positive()
    .default(defaults.queue.learningOutboxBackoffDelay),
  QUEUE_ANALYTICS_OUTBOX_CONCURRENCY: z.coerce
    .number()
    .int()
    .positive()
    .default(defaults.queue.analyticsOutboxConcurrency),
  QUEUE_ANALYTICS_OUTBOX_MAX_RETRIES: z.coerce
    .number()
    .int()
    .positive()
    .default(defaults.queue.analyticsOutboxMaxRetries),
  QUEUE_ANALYTICS_OUTBOX_BACKOFF_DELAY: z.coerce
    .number()
    .int()
    .positive()
    .default(defaults.queue.analyticsOutboxBackoffDelay),
  OUTBOX_SLO_MAX_PENDING_AGE_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(defaults.operations.outboxMaxPendingAgeSeconds),
  QUEUE_COURSE_PRODUCTION_CONCURRENCY: z.coerce
    .number()
    .int()
    .positive()
    .default(defaults.queue.courseProductionConcurrency),
  QUEUE_COURSE_PRODUCTION_MAX_RETRIES: z.coerce
    .number()
    .int()
    .min(0)
    .default(defaults.queue.courseProductionMaxRetries),
  QUEUE_COURSE_PRODUCTION_BACKOFF_DELAY: z.coerce
    .number()
    .int()
    .positive()
    .default(defaults.queue.courseProductionBackoffDelay),
  QUEUE_CAREER_TREE_CONCURRENCY: z.coerce
    .number()
    .int()
    .positive()
    .default(defaults.queue.careerTreeConcurrency),
  QUEUE_CAREER_TREE_MAX_RETRIES: z.coerce
    .number()
    .int()
    .min(0)
    .default(defaults.queue.careerTreeMaxRetries),
  QUEUE_CAREER_TREE_BACKOFF_DELAY: z.coerce
    .number()
    .int()
    .positive()
    .default(defaults.queue.careerTreeBackoffDelay),
  QUEUE_KNOWLEDGE_INSIGHTS_CONCURRENCY: z.coerce
    .number()
    .int()
    .positive()
    .default(defaults.queue.knowledgeInsightsConcurrency),
  QUEUE_KNOWLEDGE_INSIGHTS_MAX_RETRIES: z.coerce
    .number()
    .int()
    .min(0)
    .default(defaults.queue.knowledgeInsightsMaxRetries),
  QUEUE_KNOWLEDGE_INSIGHTS_BACKOFF_DELAY: z.coerce
    .number()
    .int()
    .positive()
    .default(defaults.queue.knowledgeInsightsBackoffDelay),
  QUEUE_NOTE_FOLLOWUPS_CONCURRENCY: z.coerce
    .number()
    .int()
    .positive()
    .default(defaults.queue.noteFollowupsConcurrency),
  QUEUE_NOTE_FOLLOWUPS_MAX_RETRIES: z.coerce
    .number()
    .int()
    .min(0)
    .default(defaults.queue.noteFollowupsMaxRetries),
  QUEUE_NOTE_FOLLOWUPS_BACKOFF_DELAY: z.coerce
    .number()
    .int()
    .positive()
    .default(defaults.queue.noteFollowupsBackoffDelay),
  QUEUE_RAG_CONCURRENCY: z.coerce.number().int().positive().default(defaults.queue.ragConcurrency),
  QUEUE_RAG_MAX_RETRIES: z.coerce.number().int().min(0).default(defaults.queue.ragMaxRetries),
  QUEUE_RAG_BACKOFF_DELAY: z.coerce
    .number()
    .int()
    .positive()
    .default(defaults.queue.ragBackoffDelay),
  QUEUE_RESEARCH_CONCURRENCY: z.coerce
    .number()
    .int()
    .positive()
    .default(defaults.queue.researchConcurrency),
  QUEUE_RESEARCH_MAX_RETRIES: z.coerce
    .number()
    .int()
    .min(0)
    .default(defaults.queue.researchMaxRetries),
  QUEUE_RESEARCH_BACKOFF_DELAY: z.coerce
    .number()
    .int()
    .positive()
    .default(defaults.queue.researchBackoffDelay),

  // Environment
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

type ServerEnv = z.infer<typeof serverEnvSchema>;

// ============================================
// Parse Functions
// ============================================

/**
 * Parse and validate server environment
 */
function parseServerEnv(env: NodeJS.ProcessEnv = process.env): ServerEnv {
  // Build-time check bypass for Next.js 16
  if (
    process.env.SKIP_ENV_VALIDATION === "true" ||
    process.env.NEXT_PHASE === "phase-production-build"
  ) {
    // Return partially valid data for build time
    return serverEnvSchema.partial().parse({}) as ServerEnv;
  }

  // Read from process.env for server-side
  const merged = {
    ...process.env,
    ...env,
    APP_BASE_URL: env.APP_BASE_URL ?? env.AUTH_URL ?? env.NEXT_PUBLIC_APP_URL,
  };

  const result = serverEnvSchema.safeParse(merged);

  if (!result.success) {
    console.error("❌ Server environment validation failed:");
    for (const issue of result.error.issues) {
      console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
    }
    throw new Error("Invalid server environment configuration");
  }

  if (
    result.data.NODE_ENV === "production" &&
    result.data.AUTH_SECRET === DEVELOPMENT_AUTH_SECRET
  ) {
    console.error("Server environment validation failed: AUTH_SECRET uses the development value");
    throw new Error("Invalid server environment configuration");
  }

  const economyModelPairs = [
    ["Qwen", result.data.AI_QWEN_MODEL_INTERACTIVE, result.data.AI_QWEN_MODEL_ECONOMY],
    ["DeepSeek", result.data.AI_DEEPSEEK_MODEL_INTERACTIVE, result.data.AI_DEEPSEEK_MODEL_ECONOMY],
    ["OpenAI", result.data.AI_OPENAI_MODEL_INTERACTIVE, result.data.AI_OPENAI_MODEL_ECONOMY],
  ] as const;
  for (const [series, interactiveModel, economyModel] of economyModelPairs) {
    if (interactiveModel === economyModel) {
      console.error(`${series} economy model must differ from the interactive model`);
      throw new Error("Invalid AI model economy configuration");
    }
  }

  if (result.data.NODE_ENV === "production") {
    if (!result.data.APP_BASE_URL) {
      throw new Error("APP_BASE_URL, AUTH_URL, or NEXT_PUBLIC_APP_URL is required in production");
    }
    if (result.data.AI_MODEL_PRICING_VERSION === defaults.ai.modelPricingVersion) {
      throw new Error("AI_MODEL_PRICING_VERSION must be explicit in production");
    }
    const configuredModels = new Set([
      result.data.AI_QWEN_MODEL_INTERACTIVE,
      result.data.AI_QWEN_MODEL_ECONOMY,
      result.data.AI_QWEN_MODEL_OUTLINE,
      result.data.AI_QWEN_MODEL_SECTION_DRAFT,
      result.data.AI_QWEN_MODEL_EXTRACT,
      result.data.AI_QWEN_MODEL_REVIEW,
      result.data.AI_QWEN_MODEL_WEB_SEARCH,
      result.data.AI_DEEPSEEK_MODEL_INTERACTIVE,
      result.data.AI_DEEPSEEK_MODEL_ECONOMY,
      result.data.AI_DEEPSEEK_MODEL_OUTLINE,
      result.data.AI_DEEPSEEK_MODEL_SECTION_DRAFT,
      result.data.AI_DEEPSEEK_MODEL_EXTRACT,
      result.data.AI_DEEPSEEK_MODEL_REVIEW,
      result.data.AI_DEEPSEEK_MODEL_WEB_SEARCH,
      result.data.AI_OPENAI_MODEL_INTERACTIVE,
      result.data.AI_OPENAI_MODEL_ECONOMY,
      result.data.AI_OPENAI_MODEL_OUTLINE,
      result.data.AI_OPENAI_MODEL_SECTION_DRAFT,
      result.data.AI_OPENAI_MODEL_EXTRACT,
      result.data.AI_OPENAI_MODEL_REVIEW,
      result.data.AI_OPENAI_MODEL_WEB_SEARCH,
    ]);
    const missingPricing = [...configuredModels].filter(
      (model) => !result.data.AI_MODEL_PRICING_JSON[model],
    );
    if (missingPricing.length > 0) {
      throw new Error(`AI pricing is missing for configured models: ${missingPricing.join(", ")}`);
    }
  }

  return result.data;
}

let cachedServerEnv: ServerEnv | null = null;

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
