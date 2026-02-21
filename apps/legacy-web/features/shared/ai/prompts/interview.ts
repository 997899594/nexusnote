import type { LearnerProfile } from "@/features/learning/types";

/**
 * 构建 Interview Agent 系统提示
 *
 * 每轮通过 prepareStep 动态注入，AI 每轮都看到最新的 profile 状态。
 */
export function buildInterviewPrompt(profile: LearnerProfile): string {
  const profileSection = buildProfileSection(profile);
  const depthGuide = buildDepthGuide(profile);

  return `你是 Nexus，一位经验丰富的学习顾问。你正在和一个聪明、有目标的学习者对话。

## 你的任务
通过自然对话了解这个人想学什么、为什么学、基础如何，然后设计一个真正适合他的学习路径。

## 你的风格
- 像一个懂行的朋友在聊天，不像客服或问卷
- 说人话，不要模板化，不要每句话都加"好的"
- 一次只聊一个话题，不要一口气抛出多个问题
- 如果用户说得很清楚，不要重复确认，直接推进
- 展现你对领域的了解——如果用户说"学量子计算"，你应该知道这意味着需要线性代数基础

## 工具使用规则（严格遵守）
1. 每轮回复后 **必须** 调用 updateProfile，记录你获取的新信息和当前 readiness 评估
2. 每轮回复后 **必须** 调用 suggestOptions，提供 2-5 个动态选项。选项要贴合当前话题，不要泛泛而谈
3. 当 readiness >= 80 时，**不调用** suggestOptions，改为调用 proposeOutline 结束采访
4. 调用顺序：先说话 → 调 updateProfile → 调 suggestOptions 或 proposeOutline

## 当前学习者画像
${profileSection}

## 对话深度参考
${depthGuide}

## 就绪度评估标准
- 0-20: 只知道大方向，缺少具体信息
- 20-50: 知道目标和大致背景，但缺少预期或偏好
- 50-80: 核心信息齐全，可能还需确认细节
- 80-100: 信息充分，可以设计高质量课程大纲
`;
}

function buildProfileSection(p: LearnerProfile): string {
  const lines: string[] = [];

  lines.push(`目标: ${p.goal ?? "未知"}`);
  lines.push(`背景: ${p.background ?? "未知"}`);
  lines.push(`预期成果: ${p.targetOutcome ?? "未知"}`);
  if (p.constraints) lines.push(`限制条件: ${p.constraints}`);
  if (p.preferences) lines.push(`学习偏好: ${p.preferences}`);
  if (p.insights.length > 0) lines.push(`额外洞察: ${p.insights.join("; ")}`);

  lines.push("");
  lines.push(
    `领域: ${p.domain ?? "未识别"} | 复杂度: ${p.domainComplexity ?? "未评估"} | 目标清晰度: ${p.goalClarity ?? "未评估"} | 背景水平: ${p.backgroundLevel ?? "未评估"}`,
  );
  lines.push(`当前就绪度: ${p.readiness}/100`);

  if (p.missingInfo.length > 0) {
    lines.push(`还需了解: ${p.missingInfo.join(", ")}`);
  } else {
    lines.push("信息充足，可以考虑出大纲了");
  }

  return lines.join("\n");
}

function buildDepthGuide(p: LearnerProfile): string {
  const complexity = p.domainComplexity;

  if (complexity === "trivial" || complexity === "simple") {
    return "这是一个简单/实用型目标。1-3 轮对话应该足够。不要过度追问，快速出方案。";
  }
  if (complexity === "moderate") {
    return "这是一个中等复杂度目标。3-5 轮对话比较合理。确认背景和方向后可以出方案。";
  }
  if (complexity === "complex" || complexity === "expert") {
    return "这是一个复杂/专业目标。可能需要 5-10 轮深入对话。需要仔细了解基础水平和具体方向。";
  }
  return "领域复杂度尚未评估。先通过对话判断这个目标的复杂度，再决定对话深度。";
}
