import { z } from "zod";

/**
 * 2026 架构师标准：系统级环境变量架构
 *
 * 职责：
 * 1. 统一管理所有服务端环境变量
 * 2. 使用 Zod 进行运行时强校验，确保 K8s 注入的配置正确无误
 * 3. 提供类型安全的配置访问
 *
 * 使用方式：
 * import { serverConfig } from "@/lib/config/server";
 */

const serverEnvSchema = z.object({
  // --- 基础环境 ---
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  // --- 数据库 ---
  DATABASE_URL: z.string().url(),

  // --- AI Gateway / LLM ---
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  AI_GATEWAY_URL: z.string().url().optional(),

  // --- 认证 ---
  AUTH_SECRET: z.string().min(32),
  AUTH_URL: z.string().url().optional(),

  // --- 存储 (S3/OSS) ---
  STORAGE_ACCESS_KEY: z.string().optional(),
  STORAGE_SECRET_KEY: z.string().optional(),
  STORAGE_BUCKET: z.string().optional(),
  STORAGE_ENDPOINT: z.string().optional(),
});

/**
 * 校验环境变量
 *
 * 在 2026 年的容器化架构中，我们推荐在应用启动的第一时间进行校验
 * 这样如果 K8s 配置（ConfigMap/Secret）有误，Pod 会直接 CrashLoopBackOff，
 * 而不是在运行过程中抛出难以追踪的空指针异常。
 */
function validateConfig() {
  try {
    return serverEnvSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingKeys = error.issues.map((e) => e.path.join(".")).join(", ");
      console.error(`❌ [Config Error] 缺失或非法的配置项: ${missingKeys}`);
      // 在生产环境中，我们建议直接抛出错误，阻止应用启动
      if (process.env.NODE_ENV === "production") {
        throw new Error(`Invalid configuration: ${missingKeys}`);
      }
    }
    // 开发环境下返回一个部分填充的对象，避免阻塞开发
    return process.env as any as z.infer<typeof serverEnvSchema>;
  }
}

export const serverConfig = validateConfig();
