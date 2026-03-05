/**
 * INTERVIEW Agent - 单阶段访谈
 *
 * 简化原则：
 * 1. 无复杂度评估
 * 2. 无阶段切换
 * 3. prompt 控制行为
 */

import { stepCountIs, ToolLoopAgent } from "ai";
import { aiProvider } from "../core";
import { createInterviewTools } from "../tools/interview";

const MAX_STEPS = 12;

const INSTRUCTIONS = `你是课程规划师。通过自然对话了解用户的学习需求。

规则：
- 每轮只问一个问题
- 回复后必须调用 suggestOptions 提供 3-4 个选项
- 收集足够信息后调用 confirmOutline 生成大纲

像朋友聊天，简洁自然。`;

export interface InterviewOptions {
  courseProfileId: string;
}

export function createInterviewAgent(options: InterviewOptions) {
  if (!options.courseProfileId) {
    throw new Error("courseProfileId required");
  }

  return new ToolLoopAgent({
    id: "interview",
    model: aiProvider.chatModel,
    instructions: INSTRUCTIONS,
    tools: createInterviewTools(options.courseProfileId),
    stopWhen: stepCountIs(MAX_STEPS),
  });
}
