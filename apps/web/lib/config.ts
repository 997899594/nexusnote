/**
 * NexusNote 2026 - Unified Configuration Management
 * 
 * 核心哲学：
 * 1. 12-Factor App: 通过环境变量配置一切。
 * 2. 类型安全：使用 Zod 验证配置，启动即发现错误。
 * 3. K8s 友好：完美适配 K8s ConfigMap 和 Secret 的注入。
 */

import { z } from "zod";

const configSchema = z.object({
  // 数据库
  DATABASE_URL: z.string().url(),
  
  // AI 接口 (可通过 K8s Secret 注入)
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  DEEPSEEK_API_KEY: z.string().optional(),
  
  // 环境
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  
  // 业务配置
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  
  // K8s 部署特定标识 (可选)
  K8S_POD_NAME: z.string().optional(),
  K8S_NAMESPACE: z.string().optional(),
});

// 解析并验证环境变量
// 在 2026 年，我们不应该在代码中到处使用 process.env.XXX
// 而是通过这个统一的 config 对象访问
const _env = configSchema.safeParse(process.env);

if (!_env.success) {
  console.error("❌ Invalid environment variables:", JSON.stringify(_env.error.format(), null, 2));
  // 在生产环境中，配置错误应该直接崩溃，防止由于配置不当导致的隐蔽 BUG
  if (process.env.NODE_ENV === "production") {
    throw new Error("Invalid environment variables");
  }
}

export const config = _env.success ? _env.data : ({} as z.infer<typeof configSchema>);

/**
 * K8s 复用建议：
 * 
 * 在 deployment.yaml 中：
 * envFrom:
 *   - configMapRef:
 *       name: nexusnote-config
 *   - secretRef:
 *       name: nexusnote-secrets
 * 
 * 这样应用启动时，configSchema 会自动捕获并验证这些注入的变量。
 */
