/**
 * POST /api/skills/discover - 静默后台技能发现
 *
 * 2026 架构：
 * - 非流式 API（静默后台任务）
 * - 直接运行技能发现 workflow
 * - 返回 JSON 结果
 */

import { NextResponse } from "next/server";
import { aiProvider, runDiscoverSkillsWorkflow } from "@/lib/ai";
import { withAuth } from "@/lib/api";
import { DiscoverSkillsSchema } from "@/lib/skills/validation";

export const runtime = "nodejs";
export const maxDuration = 300;

export const POST = withAuth(async (request, { userId }) => {
  const body = await request.json();
  const options = DiscoverSkillsSchema.parse(body);

  // 检查 AI 服务配置
  if (!aiProvider.isConfigured()) {
    return NextResponse.json(
      { error: "AI 服务未配置", code: "AI_NOT_CONFIGURED" },
      { status: 503 },
    );
  }

  const result = await runDiscoverSkillsWorkflow({
    userId,
    limit: options.limit,
    sources: options.sources,
  });

  // 返回 JSON 结果
  return NextResponse.json({
    ...result,
  });
});
