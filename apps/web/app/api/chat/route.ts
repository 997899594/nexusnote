import { AIGatewayService, AIRequestSchema } from "@/lib/ai/gateway/service";
import { auth } from "@/auth";
import { checkRateLimit } from "@/lib/ai/rate-limit";
import { v4 as uuidv4 } from "uuid";

/**
 * 2026 架构师标准：干净的 AI 流量入口 (Route Handler)
 * 职责：认证、限流、服务分发
 */
export async function POST(req: Request) {
  const traceId = uuidv4();

  try {
    // 1. 认证
    const session = await auth();
    if (!session?.user?.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      });
    }

    // 2. 限流
    const rateLimitResult = await checkRateLimit(session.user.id);
    if (!rateLimitResult.allowed) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429,
      });
    }

    // 3. 解析并验证请求
    const body = await req.json();
    const parseResult = AIRequestSchema.safeParse(body);

    if (!parseResult.success) {
      console.error(
        "[AI Route] Validation failed:",
        parseResult.error.format(),
      );
      return new Response(
        JSON.stringify({
          error: "Invalid request format",
          details: parseResult.error.format(),
        }),
        { status: 400 },
      );
    }

    // 4. 调用核心服务层
    return await AIGatewayService.handleRequest(parseResult.data, {
      userId: session.user.id,
      traceId,
    });
  } catch (error: any) {
    console.error(`[AI Route] TraceId: ${traceId}, Error:`, error);
    return new Response(
      JSON.stringify({
        error: error.message || "Internal Server Error",
        traceId,
      }),
      {
        status: error.status || 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
