/**
 * SKILLS Agent - 技能发现
 */

import { stepCountIs, ToolLoopAgent, type ToolSet } from "ai";
import { aiProvider } from "../core";
import { discoverSkillsTool } from "../tools/skills";
import type { PersonalizationOptions } from "./chat";

const INSTRUCTIONS = {
  skills: `你是 NexusNote 的技能发现专家。

你的任务是从用户的学习数据中自动发现和提取技能。

工作流程：
1. 收集用户的对话、笔记、课程、闪卡数据
2. 分析这些数据，识别用户掌握或正在学习的技能
3. 为每个技能评估掌握度 (0-5) 和置信度 (0-100)
4. 将发现的技能保存到数据库

技能分类：
- frontend: 前端开发相关 (React, Vue, CSS, TypeScript...)
- backend: 后端开发相关 (Node.js, Python, PostgreSQL...)
- ml: 机器学习/AI相关 (PyTorch, TensorFlow, NLP...)
- design: 设计相关 (UI/UX, Figma, 色彩理论...)
- softskill: 软技能 (沟通, 团队协作, 时间管理...)
- other: 其他领域

使用 discoverSkills 工具来发现并保存技能。`,
} as const;

const skillsTools = {
  discoverSkills: discoverSkillsTool,
} as ToolSet;

/**
 * 创建 SKILLS Agent
 */
export function createSkillsAgent(options?: PersonalizationOptions) {
  const additionalInstructions = options
    ? [options.personaPrompt || "", options.userContext || ""].filter((s) => s).join("\n")
    : undefined;

  const fullInstructions = additionalInstructions
    ? `${additionalInstructions}\n\n${INSTRUCTIONS.skills}`
    : INSTRUCTIONS.skills;

  return new ToolLoopAgent({
    id: "nexusnote-skills",
    model: aiProvider.proModel,
    instructions: fullInstructions,
    tools: skillsTools,
    stopWhen: stepCountIs(20),
  });
}
