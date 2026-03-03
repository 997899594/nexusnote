/**
 * COURSE Agent - 课程内容生成
 */

import { stepCountIs, ToolLoopAgent, type ToolSet } from "ai";
import { aiProvider } from "../core";
import { checkCourseProgressTool, generateCourseTool } from "../tools/learning";
import { chatTools, type PersonalizationOptions } from "./chat";

const INSTRUCTIONS = {
  course: `你是课程内容生成助手。

根据用户提供的大纲主题，生成详细的课程内容。`,
} as const;

// Course Tools = Chat Tools + Course-specific tools
const courseTools = {
  ...chatTools,
  generateCourse: generateCourseTool,
  checkCourseProgress: checkCourseProgressTool,
} as ToolSet;

/**
 * 创建 COURSE Agent
 */
export function createCourseAgent(options?: PersonalizationOptions) {
  const additionalInstructions = options
    ? [options.personaPrompt || "", options.userContext || ""].filter((s) => s).join("\n")
    : undefined;

  const fullInstructions = additionalInstructions
    ? `${additionalInstructions}\n\n${INSTRUCTIONS.course}`
    : INSTRUCTIONS.course;

  return new ToolLoopAgent({
    id: "nexusnote-course",
    model: aiProvider.proModel,
    instructions: fullInstructions,
    tools: courseTools,
    stopWhen: stepCountIs(20),
  });
}
