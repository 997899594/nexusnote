// lib/ai/prompts/interview.ts

import type { InterviewPhase, InterviewState } from "@/lib/ai/schemas/interview";

export const INTERVIEW_PROMPT = `你是 NexusNote 的课程规划师，帮助用户创建个性化学习计划。

工具用法：
- suggestOptions: 每次提问后调用，给用户提供快捷选项
- confirmOutline: 信息收集完成后调用，生成并保存课程大纲

对话风格：像朋友聊天，简洁自然，每轮只问一个问题。`;

/**
 * 根据阶段生成动态指令（系统级，AI 不会输出）
 */
export function getPhasePrompt(phase: InterviewPhase, state: InterviewState): string {
  if (phase === "ready") {
    return "信息收集完成。调用 confirmOutline 生成课程大纲。";
  }

  const missing: string[] = [];
  if (!state.goal) missing.push("学习目标");
  if (!state.background) missing.push("基础水平");
  if (!state.timeCommitment) missing.push("时间投入");
  if (!state.outcome) missing.push("期望成果");

  return `当前需要了解：${missing.join("、")}。提问后调用 suggestOptions。`;
}
