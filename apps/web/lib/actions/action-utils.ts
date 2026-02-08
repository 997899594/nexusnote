import { auth } from "@/auth";
import { ActionResult, success, error } from "./types";
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
      const session = await auth();
      if (!session?.user?.id) {
        return error("Unauthorized", "UNAUTHORIZED");
      }

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

      const result = await handler(validatedPayload, session.user.id);
      return success(result);
    } catch (err) {
      console.error(`[Action Error: ${name}]`, err);
      return error(
        err instanceof Error ? err.message : "An unexpected error occurred",
        "INTERNAL_ERROR",
      );
    }
  };
}
