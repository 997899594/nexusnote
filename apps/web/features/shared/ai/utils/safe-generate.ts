/**
 * safeGenerateObject — 带 schema 验证重试的结构化输出
 *
 * 当 LLM 返回不符合 schema 的 JSON 时：
 * 1. 捕获验证错误
 * 2. 在 prompt 中附加错误信息
 * 3. 让 LLM 修正输出
 * 4. 达到 maxRetries 后抛出最终错误
 */

import { generateObject } from "ai";
import type { LanguageModelV3 } from "@ai-sdk/provider";
import type { ZodSchema } from "zod";

// ============================================
// 类型定义
// ============================================

export interface SafeGenerateOptions<T> {
  /** Zod schema 定义期望的输出结构 */
  schema: ZodSchema<T>;
  /** schema 验证失败后的重试次数（区别于网络重试） */
  maxRetries?: number;
  /** 使用的语言模型 */
  model: LanguageModelV3;
  /** 系统提示 */
  system: string;
  /** 用户提示 */
  prompt: string;
  /** 生成温度 */
  temperature?: number;
}

// ============================================
// 核心函数
// ============================================

export async function safeGenerateObject<T>(
  options: SafeGenerateOptions<T>,
): Promise<T> {
  const { schema, maxRetries = 2, ...generateOptions } = options;
  let currentPrompt = generateOptions.prompt;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await generateObject({
        ...generateOptions,
        prompt: currentPrompt,
        schema,
      });
      return result.object;
    } catch (error) {
      // 最后一次尝试，直接抛出
      if (attempt === maxRetries) throw error;

      // schema 验证错误：在 prompt 中附加错误信息让 LLM 修正
      if (error instanceof Error) {
        console.warn(
          `[safeGenerateObject] 第 ${attempt + 1} 次尝试失败: ${error.message}`,
        );
        currentPrompt = `${generateOptions.prompt}\n\n[系统提示: 上次输出格式错误: ${error.message}. 请严格遵循 JSON schema 输出。]`;
      }
    }
  }

  // 不可达，但 TypeScript 需要
  throw new Error("[safeGenerateObject] 所有重试均失败");
}
