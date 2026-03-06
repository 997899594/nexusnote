// lib/ai/prompts/interview.ts

import type { InterviewPhase, InterviewState } from "@/lib/ai/schemas/interview";

export const INTERVIEW_PROMPT = `你是 NexusNote 的课程规划师，帮助用户创建个性化学习计划。

## 收集信息（按顺序）

1. **goal** - 学习目标：用户想学什么？
2. **background** - 基础水平：none（零基础）/ beginner（初学）/ intermediate（中级）/ advanced（高级）
3. **outcome** - 期望成果：学完后能达到什么状态？

## 工具用法

- **updateProfile**: 收集到任一指标时立即调用，更新用户画像
- **confirmOutline**: 三个指标收集完成后调用，生成课程大纲
  - 用户提出修改建议时再次调用，更新大纲

## 对话风格

像朋友聊天，简洁自然，每轮只问一个问题。`;

/**
 * 根据阶段生成动态指令
 */
export function getPhasePrompt(phase: InterviewPhase, state: InterviewState | null): string {
  if (phase === "ready") {
    return "三个指标已收集完成。立即调用 confirmOutline 生成课程大纲。";
  }

  if (phase === "completed") {
    return "大纲已确认。根据用户反馈调整，调用 confirmOutline 更新大纲。";
  }

  const missing: string[] = [];
  if (!state?.goal) missing.push("学习目标 (goal)");
  if (!state?.background) missing.push("基础水平 (background)");
  if (!state?.outcome) missing.push("期望成果 (outcome)");

  return `当前阶段：${phase}
缺少信息：${missing.join("、")}
提问后调用 updateProfile 更新画像。`;
}
