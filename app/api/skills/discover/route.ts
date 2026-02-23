/**
 * POST /api/skills/discover - 流式技能发现
 */

import { createAgentUIStreamResponse, smoothStream, type UIMessage } from "ai";
import { type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getAgent } from "@/lib/ai";
import { handleError, APIError } from "@/lib/api";
import { DiscoverSkillsSchema } from "@/lib/skills/validation";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      throw new APIError("Unauthorized", 401, "UNAUTHORIZED");
    }

    const body = await request.json();
    const options = DiscoverSkillsSchema.parse(body);

    // 构建用户消息
    const content = `请从我的学习数据中发现技能。
用户 ID: ${session.user.id}
数据源: ${options.sources?.join(", ") || "全部"}
限制: ${options.limit} 条`;

    const uiMessages: UIMessage[] = [
      { id: "msg-1", role: "user", parts: [{ type: "text", text: content }] }
    ];

    return createAgentUIStreamResponse({
      agent: getAgent("SKILLS"),
      uiMessages,
      experimental_transform: smoothStream({
        chunking: new Intl.Segmenter("zh-CN", { granularity: "grapheme" }),
      }),
    });
  } catch (error) {
    return handleError(error);
  }
}
