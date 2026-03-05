/**
 * POST /api/skills/discover - 静默后台技能发现
 *
 * 2026 架构：
 * - 非流式 API（静默后台任务）
 * - 使用 generateText + tools（非 streaming）
 * - 返回 JSON 结果
 */

import { generateText, type ToolSet } from "ai";
import { NextResponse } from "next/server";
import { aiProvider } from "@/lib/ai/core/provider";
import { SKILLS_PROMPT } from "@/lib/ai/prompts/skills";
import { buildAgentTools } from "@/lib/ai/tools";
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

  // 构建提示词
  const prompt = `${SKILLS_PROMPT}

用户 ID: ${userId}
数据源: ${options.sources?.join(", ") || "全部"}
限制: ${options.limit} 条

请使用 discoverSkills 工具来发现并保存技能。`;

  // 构建工具（仅 discoverSkills，无交互工具）
  const tools = buildAgentTools("skills", { userId }) as ToolSet;

  // 非流式调用
  const result = await generateText({
    model: aiProvider.proModel,
    prompt,
    tools,
    temperature: 0.2, // 低温度保证一致性
  });

  // 返回 JSON 结果
  return NextResponse.json({
    success: true,
    finishReason: result.finishReason,
    steps: result.steps.length,
    usage: result.usage,
  });
});
