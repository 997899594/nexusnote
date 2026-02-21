/**
 * Fallback Language Model — 多 Provider 自动切换
 *
 * 包装多个 provider 的同功能 model，调用时按优先级尝试：
 * 1. 检查熔断器，跳过已熔断的 provider
 * 2. 调用 doGenerate / doStream
 * 3. 成功 → 重置熔断器，返回结果
 * 4. 失败 → 标记失败，尝试下一个 provider
 * 5. 全部失败 → 抛出 AggregateError
 */

import type { CircuitBreaker } from "./circuit-breaker";

/**
 * 任何带 doGenerate/doStream 的 model 对象
 * 兼容 AI SDK v6 的 LanguageModelV2 和 LanguageModelV3
 */
interface ModelLike {
  readonly specificationVersion: string;
  readonly provider: string;
  readonly modelId: string;
  supportedUrls?: unknown;
  doGenerate(options: unknown): PromiseLike<unknown>;
  doStream(options: unknown): PromiseLike<unknown>;
}

export interface FallbackCandidate {
  model: ModelLike;
  breaker: CircuitBreaker;
}

/**
 * 创建 fallback model，返回值类型与传入的 primary model 一致
 */
export function createFallbackModel(candidates: FallbackCandidate[]): ModelLike {
  if (candidates.length === 0) {
    throw new Error("[FallbackModel] 至少需要一个 candidate");
  }

  const primary = candidates[0].model;

  return {
    specificationVersion: primary.specificationVersion,
    provider: "fallback",
    modelId: candidates.map((c) => c.model.modelId).join(" → "),
    supportedUrls: primary.supportedUrls,

    doGenerate(options: unknown) {
      return tryWithFallback(candidates, "doGenerate", options);
    },

    doStream(options: unknown) {
      return tryWithFallback(candidates, "doStream", options);
    },
  };
}

/**
 * 按优先级尝试每个 candidate，跳过已熔断的，失败后自动切换
 */
async function tryWithFallback(
  candidates: FallbackCandidate[],
  method: "doGenerate" | "doStream",
  options: unknown,
): Promise<unknown> {
  const errors: Error[] = [];

  for (const { model, breaker } of candidates) {
    if (!breaker.canExecute()) {
      errors.push(new Error(`[${breaker.name}] 已熔断，跳过`));
      continue;
    }

    try {
      const result = await model[method](options);
      breaker.onSuccess();
      return result;
    } catch (err) {
      breaker.onFailure();
      const error = err instanceof Error ? err : new Error(String(err));
      console.error(`[FallbackModel] ${breaker.name} 失败，尝试下一个: ${error.message}`);
      errors.push(error);
    }
  }

  throw new AggregateError(
    errors,
    `[FallbackModel] 所有 provider 均失败: ${errors.map((e) => e.message).join("; ")}`,
  );
}
