// lib/ai/core/nested-ai.ts

import { generateText, Output } from "ai";
import { z } from "zod";
import { aiProvider } from "../core";

// ============================================
// Types
// ============================================

export interface NestedAIOptions {
  /** 超时时间，默认 30 秒 */
  timeout?: number;
  /** 温度，默认 0.3 */
  temperature?: number;
  /** 使用 Pro 模型，默认 false */
  useProModel?: boolean;
}

export interface NestedAIResult<T> {
  success: boolean;
  data: T | null;
  error?: string;
  durationMs: number;
}

// ============================================
// Core Function
// ============================================

/**
 * 嵌套 AI 调用封装
 *
 * 统一处理：
 * - 超时控制
 * - 错误处理
 * - 日志记录
 */
export async function callNestedAI<T>(
  prompt: string,
  schema: z.ZodSchema<T>,
  options: NestedAIOptions = {},
): Promise<NestedAIResult<T>> {
  const startTime = Date.now();
  const { timeout = 30_000, temperature = 0.3, useProModel = false } = options;

  const model = useProModel ? aiProvider.proModel : aiProvider.chatModel;

  if (!model) {
    return {
      success: false,
      data: null,
      error: "AI 模型未配置",
      durationMs: 0,
    };
  }

  try {
    const result = await generateText({
      model,
      prompt,
      temperature,
      timeout,
      output: Output.object({ schema }),
    });

    const durationMs = Date.now() - startTime;
    console.log("[NestedAI] Success", { durationMs });

    return {
      success: true,
      data: result.output as T,
      durationMs,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    console.error("[NestedAI] Error:", errorMessage, { durationMs });

    return {
      success: false,
      data: null,
      error: errorMessage,
      durationMs,
    };
  }
}
