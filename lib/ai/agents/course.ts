/**
 * COURSE Agent - 课程内容生成
 */

import { stepCountIs, ToolLoopAgent, type ToolSet } from "ai";
import { aiProvider } from "../core";
import { createToolContext } from "../core/tool-context";
import { buildAgentTools } from "../tools";
import type { PersonalizationOptions } from "./chat";

const INSTRUCTIONS = `你是课程内容生成助手。

根据用户提供的大纲主题，生成详细的课程内容。`;

/**
 * 创建 COURSE Agent
 */
export function createCourseAgent(options?: PersonalizationOptions) {
  if (!options?.userId) {
    throw new Error("Course agent requires userId");
  }

  const additionalInstructions = [options.personaPrompt || "", options.userContext || ""]
    .filter((s) => s)
    .join("\n");

  const fullInstructions = additionalInstructions
    ? `${additionalInstructions}\n\n${INSTRUCTIONS}`
    : INSTRUCTIONS;

  const ctx = createToolContext({ userId: options.userId });
  const courseTools = buildAgentTools("course", ctx) as ToolSet;

  return new ToolLoopAgent({
    id: "nexusnote-course",
    model: aiProvider.proModel,
    instructions: fullInstructions,
    tools: courseTools,
    stopWhen: stepCountIs(20),
  });
}
