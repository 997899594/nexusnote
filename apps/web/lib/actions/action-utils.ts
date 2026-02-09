import { requireUserId } from "@/lib/auth/auth-utils";
import { success, error, logError, handleActionError } from "@/lib/errors";
import type { ActionResult } from "@/lib/errors";
import { z } from "zod";

/**
 * 2026 架构师标准：Server Action 包装器
 *
 * 提供统一的：
 * 1. 异常处理
 * 2. 身份验证检查
 * 3. 日志记录
 * 4. 类型安全
 */
export function createSafeAction<T, R>(
  arg1: string | z.ZodType<T>,
  arg2: (payload: T, userId: string) => Promise<R>,
): (payload?: T) => Promise<ActionResult<R>> {
  const name = typeof arg1 === "string" ? arg1 : "SafeAction";
  const schema = typeof arg1 === "string" ? null : arg1;
  const handler = arg2;

  return async (payload?: T): Promise<ActionResult<R>> => {
    try {
      // 使用统一的 auth 工具
      const userId = await requireUserId();

      let validatedPayload = payload as T;
      if (schema && payload !== undefined) {
        const validation = schema.safeParse(payload);
        if (!validation.success) {
          return error(
            `Validation failed: ${validation.error.message}`,
            "VALIDATION_ERROR",
          );
        }
        validatedPayload = validation.data;
      }

      const result = await handler(validatedPayload, userId);
      return success(result);
    } catch (err) {
      // 使用统一的错误日志
      logError(name, err);
      return handleActionError(err);
    }
  };
}
