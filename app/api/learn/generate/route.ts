// app/api/learn/generate/route.ts

import type { NextRequest } from "next/server";
import { z } from "zod";
import { aiModelGateway } from "@/lib/ai/core/model-gateway";
import { runGenerateCourseSectionWorkflow } from "@/lib/ai/workflows/generate-course-section";
import { parseJsonBodyAs, serviceUnavailable, withAuth } from "@/lib/api";
import { checkRateLimitOrThrow } from "@/lib/api/rate-limit";
import { createLearnTrace } from "@/lib/learning/observability";

export const maxDuration = 300;

const RequestSchema = z.object({
  courseId: z.string().uuid(),
  chapterIndex: z.number().int().min(0),
  sectionIndex: z.number().int().min(0),
});

export const POST = withAuth(async (request: NextRequest, { userId }) => {
  let trace: ReturnType<typeof createLearnTrace> | null = null;

  try {
    trace = createLearnTrace("generate-route", {
      userId,
      method: request.method,
    });

    if (!aiModelGateway.isConfigured()) {
      throw serviceUnavailable("助手服务暂时不可用", "AI_NOT_CONFIGURED");
    }

    // Rate limit: 20 generate requests per minute per user
    await checkRateLimitOrThrow(
      `learn-generate:${userId}`,
      20,
      60 * 1000,
      "请求过于频繁，请稍后再试",
      { failureMode: "deny" },
    );
    trace.step("rate-limit-ok");

    const { courseId, chapterIndex, sectionIndex } = await parseJsonBodyAs(request, RequestSchema);
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
    throw error;
  }
});
