import { z } from 'zod'

/**
 * Environment variable validation schema
 * 启动时验证所有环境变量，确保配置正确
 */
const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url().default('postgresql://postgres:postgres@localhost:5433/nexusnote'),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6380'),

  // Server
  PORT: z.coerce.number().int().positive().default(3001),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  HOCUSPOCUS_PORT: z.coerce.number().int().positive().default(1234),

  // AI Provider - 302.ai
  AI_302_API_KEY: z.string().optional(),
  EMBEDDING_MODEL: z.string().default('Qwen/Qwen3-Embedding-8B'),
  EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().max(8192).default(4000),
  RERANKER_MODEL: z.string().default('Qwen/Qwen3-Reranker-8B'),
  RERANKER_ENABLED: z.string().default('false').transform(v => v === 'true'),

  // Environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
})

export type Env = z.infer<typeof envSchema>

// 解析并验证环境变量
function parseEnv(): Env {
  const result = envSchema.safeParse(process.env)

  if (!result.success) {
    console.error('❌ Environment validation failed:')
    for (const issue of result.error.issues) {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`)
    }
    throw new Error('Invalid environment configuration')
  }

  return result.data
}

// 单例导出
export const env = parseEnv()

// 启动时打印配置（隐藏敏感信息）
export function logEnvConfig() {
  console.log('[Config] Environment validated:')
  console.log(`  NODE_ENV: ${env.NODE_ENV}`)
  console.log(`  PORT: ${env.PORT}`)
  console.log(`  HOCUSPOCUS_PORT: ${env.HOCUSPOCUS_PORT}`)
  console.log(`  DATABASE_URL: ${env.DATABASE_URL.replace(/\/\/[^@]+@/, '//***@')}`)
  console.log(`  REDIS_URL: ${env.REDIS_URL}`)
  console.log(`  AI_302_API_KEY: ${env.AI_302_API_KEY ? '***' : '(not set)'}`)
  console.log(`  EMBEDDING_MODEL: ${env.EMBEDDING_MODEL}`)
  console.log(`  EMBEDDING_DIMENSIONS: ${env.EMBEDDING_DIMENSIONS}`)
  console.log(`  RERANKER_ENABLED: ${env.RERANKER_ENABLED}`)
}
