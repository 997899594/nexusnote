/**
 * AI Agents - 2026 Modern Architecture
 *
 * 基于 ToolLoopAgent 的现代化 Agent 实现
 */

import { hasToolCall, type StopCondition, stepCountIs, ToolLoopAgent, type ToolSet } from "ai";

// 导入 aiProvider 从同级的 core.ts
import { aiProvider } from "../core";

import {
  createNoteTool,
  deleteNoteTool,
  getNoteTool,
  searchNotesTool,
  updateNoteTool,
  webSearchTool,
} from "../tools/chat";
import { batchEditTool, draftContentTool, editDocumentTool } from "../tools/editor";
import {
  checkCourseProgressTool,
  generateCourseTool,
  mindMapTool,
  summarizeTool,
} from "../tools/learning";
import { hybridSearchTool } from "../tools/rag";
import { discoverSkillsTool } from "../tools/skills";

import { createInterviewAgent, type InterviewOptions } from "./interview";

// Re-export InterviewOptions for external use
export type { InterviewOptions } from "./interview";

const DEFAULT_MAX_STEPS = 20;
const INTERVIEW_MAX_STEPS = 12;

const INSTRUCTIONS = {
  chat: `你是 NexusNote 智能助手。

核心能力：
- 搜索和管理用户的笔记 (使用 searchNotes、hybridSearch、getNote)
- 创建/编辑/删除笔记 (使用 createNote、updateNote、deleteNote)
- 文档编辑 (使用 editDocument、batchEdit、draftContent)
- 生成思维导图 (使用 mindMap)
- 生成摘要 (使用 summarize)
- 互联网搜索 (使用 webSearch)

行为准则：
- 主动、简洁、有益
- 需要用户确认的操作（如删除）必须先询问
- 使用工具获取信息，不要编造`,

  course: `你是课程内容生成助手。

根据用户提供的大纲主题，生成详细的课程内容。`,

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

// Chat Tools - 轻量级，专注通用对话
const chatTools = {
  // Notes CRUD
  createNote: createNoteTool,
  getNote: getNoteTool,
  updateNote: updateNoteTool,
  deleteNote: deleteNoteTool,
  // Search
  searchNotes: searchNotesTool,
  hybridSearch: hybridSearchTool,
  webSearch: webSearchTool,
  // Learning
  mindMap: mindMapTool,
  summarize: summarizeTool,
  // Editor
  editDocument: editDocumentTool,
  batchEdit: batchEditTool,
  draftContent: draftContentTool,
} as ToolSet;

const skillsTools = {
  discoverSkills: discoverSkillsTool,
} as ToolSet;

const courseTools = {
  ...chatTools,
  generateCourse: generateCourseTool,
  checkCourseProgress: checkCourseProgressTool,
} as ToolSet;

// interviewTools 动态创建，见 getAgent

function createAgent(
  id: string,
  model: ReturnType<typeof aiProvider.getModel>,
  instructions: string,
  tools: ToolSet,
  additionalInstructions?: string,
  stopWhen?: StopCondition<ToolSet> | StopCondition<ToolSet>[],
) {
  const fullInstructions = additionalInstructions
    ? `${additionalInstructions}\n\n${instructions}`
    : instructions;

  return new ToolLoopAgent({
    id,
    model,
    instructions: fullInstructions,
    tools,
    stopWhen: stopWhen ?? [hasToolCall("confirmOutline"), stepCountIs(INTERVIEW_MAX_STEPS)],
  });
}

interface PersonalizationOptions {
  personaPrompt?: string;
  userContext?: string;
}

export function getAgent(
  intent: "CHAT" | "INTERVIEW" | "COURSE" | "EDITOR" | "SEARCH" | "SKILLS",
  options?: PersonalizationOptions | InterviewOptions,
) {
  // 判断是否是 Interview 模式
  const isInterview = intent === "INTERVIEW" && options && "courseProfileId" in options;
  const courseProfileId = isInterview ? (options as InterviewOptions).courseProfileId : undefined;
  const personalization = isInterview ? undefined : (options as PersonalizationOptions | undefined);

  // Build additional instructions from personalization data
  const additionalInstructions = personalization
    ? [personalization.personaPrompt || "", personalization.userContext || ""]
        .filter((s) => s)
        .join("\n")
    : undefined;

  switch (intent) {
    case "INTERVIEW": {
      if (!courseProfileId) {
        throw new Error("INTERVIEW agent requires courseProfileId");
      }
      return createInterviewAgent({ courseProfileId });
    }
    case "COURSE":
      return createAgent(
        "nexusnote-course",
        aiProvider.proModel,
        INSTRUCTIONS.course,
        courseTools,
        additionalInstructions,
      );
    case "SKILLS":
      return createAgent(
        "nexusnote-skills",
        aiProvider.proModel,
        INSTRUCTIONS.skills,
        skillsTools,
        additionalInstructions,
      );
    default:
      return createAgent(
        "nexusnote-chat",
        aiProvider.chatModel,
        INSTRUCTIONS.chat,
        chatTools,
        additionalInstructions,
      );
  }
}
