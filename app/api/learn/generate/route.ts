// app/api/learn/generate/route.ts

import type { NextRequest } from "next/server";
import { z } from "zod";
import { aiProvider, runGenerateCourseSectionWorkflow } from "@/lib/ai";
import { APIError, handleError } from "@/lib/api";
import { auth } from "@/lib/auth";
import { checkRateLimitOrThrow } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 300;

const RequestSchema = z.object({
  courseId: z.string().uuid(),
  chapterIndex: z.number().int().min(0),
  sectionIndex: z.number().int().min(0),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      throw new APIError("请先登录", 401, "UNAUTHORIZED");
    }

    if (!aiProvider.isConfigured()) {
      throw new APIError("AI 服务未配置", 503, "AI_NOT_CONFIGURED");
    }

    // Rate limit: 20 generate requests per minute per user
    checkRateLimitOrThrow(`learn-generate:${userId}`, 20, 60 * 1000);

    const body = await request.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new APIError("请求参数无效", 400, "VALIDATION_ERROR");
    }

    const { courseId, chapterIndex, sectionIndex } = parsed.data;

    return await runGenerateCourseSectionWorkflow({
      userId,
      courseId,
      chapterIndex,
      sectionIndex,
    });
  } catch (error) {
    return handleError(error);
  }
}
