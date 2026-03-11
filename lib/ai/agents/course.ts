/**
 * COURSE Agent - 课程内容生成
 */

import { stepCountIs, ToolLoopAgent, type ToolSet } from "ai";
import { aiProvider } from "../core";
import { createToolContext } from "../core/tool-context";
import { buildInstructions } from "../prompts/chat";
import { buildAgentTools } from "../tools";
import type { PersonalizationOptions } from "./chat";

const COURSE_PROMPT = `你是课程内容生成助手。

根据用户提供的大纲主题，生成详细的课程内容。`;

/**
 * 创建 COURSE Agent
 */
export function createCourseAgent(options?: PersonalizationOptions) {
  if (!options?.userId) {
    throw new Error("Course agent requires userId");
  }

  // 正确顺序：系统行为规则在前，persona 风格在后
  const instructions = buildInstructions(COURSE_PROMPT, {
    personaPrompt: options.personaPrompt,
    userContext: options.userContext,
  });

  const ctx = createToolContext({ userId: options.userId });
  const courseTools = buildAgentTools("course", ctx) as ToolSet;

  return new ToolLoopAgent({
    id: "nexusnote-course",
    model: aiProvider.proModel,
    instructions,
    tools: courseTools,
    stopWhen: stepCountIs(20),
  });
}
