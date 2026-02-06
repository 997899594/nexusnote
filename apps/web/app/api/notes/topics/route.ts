/**
 * Topics API - Fullstack Implementation
 *
 * 直接查询数据库获取用户的语义主题
 * 不再代理外部 API_URL，完全本地处理
 */

import { auth } from "@/auth";
import { db, topics, eq } from "@nexusnote/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    // 认证检查：使用 session 而非 query params
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json(
        { error: "Unauthorized", topics: [] },
        { status: 401 }
      );
    }

    // 直接从数据库查询用户的主题
    const userTopics = await db
      .select()
      .from(topics)
      .where(eq(topics.userId, session.user.id))
      .orderBy(topics.createdAt);

    return Response.json(userTopics);
  } catch (err) {
    console.error("[Topics API] Error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json(
      { error: message, topics: [] },
      { status: 500 }
    );
  }
}
