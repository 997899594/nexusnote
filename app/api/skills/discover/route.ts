/**
 * POST /api/skills/discover - 流式技能发现
 */

import type { UIMessage } from "ai";
import { createNexusNoteStreamResponse, getAgent } from "@/lib/ai";
import { withAuth } from "@/lib/api";
import { DiscoverSkillsSchema } from "@/lib/skills/validation";

export const runtime = "nodejs";
export const maxDuration = 300;

export const POST = withAuth(async (request, { userId }) => {
  const body = await request.json();
  const options = DiscoverSkillsSchema.parse(body);

  // 构建用户消息
  const content = `请从我的学习数据中发现技能。
用户 ID: ${userId}
数据源: ${options.sources?.join(", ") || "全部"}
限制: ${options.limit} 条`;

  const uiMessages: UIMessage[] = [
    { id: "msg-1", role: "user", parts: [{ type: "text", text: content }] },
  ];

  const agent = getAgent("SKILLS", { userId });

  return createNexusNoteStreamResponse(agent, uiMessages);
});
