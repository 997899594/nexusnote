// app/api/learn/generate/route.ts

import type { NextRequest } from "next/server";
import { z } from "zod";
import { aiProvider, runGenerateCourseSectionWorkflow } from "@/lib/ai";
import { APIError, handleError } from "@/lib/api";
import { auth } from "@/lib/auth";
import { createLearnTrace } from "@/lib/learning/observability";
import { checkRateLimitOrThrow } from "@/lib/rate-limit";

export const maxDuration = 300;

const RequestSchema = z.object({
  courseId: z.string().uuid(),
  chapterIndex: z.number().int().min(0),
  sectionIndex: z.number().int().min(0),
});

export async function POST(request: NextRequest) {
  let trace: ReturnType<typeof createLearnTrace> | null = null;

  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      throw new APIError("请先登录", 401, "UNAUTHORIZED");
    }

    trace = createLearnTrace("generate-route", {
      userId,
      method: request.method,
    });

    if (!aiProvider.isConfigured()) {
      throw new APIError("AI 服务未配置", 503, "AI_NOT_CONFIGURED");
    }

    // Rate limit: 20 generate requests per minute per user
    await checkRateLimitOrThrow(`learn-generate:${userId}`, 20, 60 * 1000);
    trace.step("rate-limit-ok");

    const body = await request.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new APIError("请求参数无效", 400, "VALIDATION_ERROR");
    }

    const { courseId, chapterIndex, sectionIndex } = parsed.data;
    trace.step("request-validated", {
      courseId,
      chapterIndex,
      sectionIndex,
    });

    const response = await runGenerateCourseSectionWorkflow({
      userId,
      courseId,
      chapterIndex,
      sectionIndex,
      traceId: trace.traceId,
    });

    trace.finish({
      status: response.status,
      courseId,
      chapterIndex,
      sectionIndex,
      sectionId: response.headers.get("X-Section-Id"),
    });

    return response;
  } catch (error) {
    trace?.fail(error);
    return handleError(error);
  }
}
