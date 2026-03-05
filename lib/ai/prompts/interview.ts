// lib/ai/prompts/interview.ts

import type { InterviewState, InterviewPhase } from "@/lib/ai/schemas/interview";

export const INTERVIEW_PROMPT = `你是 NexusNote 的课程规划师。

## 工具说明

- suggestOptions: 向用户展示选项卡片，用于收集信息
- confirmOutline: 生成课程大纲（信息收集完成后调用）

## 工作流程

1. 自然对话了解用户需求
2. 每轮结束时调用 suggestOptions 展示选项
3. 信息收集完成后调用 confirmOutline 生成大纲

## 核心规则

1. 每轮只问一个问题
2. 提问后调用 suggestOptions
3. 像朋友聊天，简洁自然`;

/**
 * 构建进度指示器
 */
function buildProgressIndicator(state: InterviewState): string {
  const items = [
    state.goal ? `✅ 学习目标: ${state.goal}` : "⏳ 学习目标（待确认）",
    state.background ? `✅ 基础水平: ${state.background}` : "⏳ 基础水平（待确认）",
    state.timeCommitment ? `✅ 时间投入: ${state.timeCommitment}` : "⏳ 时间投入（待确认）",
    state.outcome ? `✅ 期望成果: ${state.outcome}` : "⏳ 期望成果（待确认）",
  ];

  return `## 📊 收集进度\n\n${items.join("\n")}`;
}

/**
 * 根据阶段生成动态 Prompt
 */
export function getPhasePrompt(phase: InterviewPhase, state: InterviewState): string {
  const progress = buildProgressIndicator(state);

  if (phase === "ready") {
    return `${progress}

现在可以生成课程大纲了。调用 confirmOutline 工具。`;
  }

  const missing: string[] = [];
  if (!state.goal) missing.push("学习目标");
  if (!state.background) missing.push("基础水平");
  if (!state.timeCommitment) missing.push("时间投入");
  if (!state.outcome) missing.push("期望成果");

  return `${progress}

还需要了解：${missing.join("、")}
继续对话，然后调用 suggestOptions。`;
}
