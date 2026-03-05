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

const INSTRUCTIONS = `你是课程规划师。

## 核心规则（必须遵守）

1. **每轮只能问一个问题** - 不要连续问多个问题
2. **回复后调用 suggestOptions** - 提供 3-4 个选项
3. **生成或调整大纲时调用 confirmOutline**

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
