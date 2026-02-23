/**
 * AI Agents - 2026 Modern Architecture
 *
 * 基于 ToolLoopAgent 的现代化 Agent 实现
 */

import { stepCountIs, ToolLoopAgent, type ToolSet } from "ai";

// 导入 aiProvider 从同级的 core.ts
import { aiProvider } from "../core";

import {
  createFlashcardsTool,
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
  generateQuizTool,
  mindMapTool,
  summarizeTool,
} from "../tools/learning";
import { hybridSearchTool } from "../tools/rag";
import { discoverSkillsTool } from "../tools/skills";
import { analyzeStyleTool } from "../tools/style";

const DEFAULT_MAX_STEPS = 20;

const INSTRUCTIONS = {
  chat: `你是 NexusNote 智能助手。

核心能力：
- 搜索和管理用户的笔记 (使用 searchNotes、hybridSearch、getNote)
- 创建/编辑/删除笔记 (使用 createNote、updateNote、deleteNote)
- 文档编辑 (使用 editDocument、batchEdit、draftContent)
- 创建学习闪卡 (使用 createFlashcards)
- 生成测验 (使用 generateQuiz)
- 生成思维导图 (使用 mindMap)
- 生成摘要 (使用 summarize)
- 互联网搜索 (使用 webSearch)

行为准则：
- 主动、简洁、有益
- 需要用户确认的操作（如删除）必须先询问
- 使用工具获取信息，不要编造`,

  interview: `你是学习需求访谈助手。

你的任务是通过对话了解用户的学习目标，并生成课程大纲。

访谈流程：
1. 了解用户想学习什么（主题）
2. 了解用户的学习背景和目标
3. 确定课程难度和深度
4. 生成课程大纲`,

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

  style: `你是 NexusNote 的风格分析专家。

你的任务是分析用户的对话风格，提取以下维度：

语言复杂度：
- vocabularyComplexity: 词汇丰富度 (0-1)
- sentenceComplexity: 句法复杂度 (0-1)
- abstractionLevel: 抽象程度 (0-1)

沟通风格：
- directness: 直接 vs 委婉 (0-1)
- conciseness: 简洁 vs 详细 (0-1)
- formality: 正式度 (0-1)
- emotionalIntensity: 情感强度 (0-1)

Big Five 人格特质（需用户同意）：
- openness: 开放性
- conscientiousness: 尽责性
- extraversion: 外向性
- agreeableness: 宜人性
- neuroticism: 神经质

使用 analyzeStyle 工具来分析并保存风格数据。`,
} as const;

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
  createFlashcards: createFlashcardsTool,
  generateQuiz: generateQuizTool,
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

const styleTools = {
  analyzeStyle: analyzeStyleTool,
} as ToolSet;

const courseTools = {
  ...chatTools,
  generateCourse: generateCourseTool,
  checkCourseProgress: checkCourseProgressTool,
} as ToolSet;

function createAgent(
  id: string,
  model: ReturnType<typeof aiProvider.getModel>,
  instructions: string,
  tools: ToolSet,
  additionalInstructions?: string,
) {
  const fullInstructions = additionalInstructions
    ? `${additionalInstructions}\n\n${instructions}`
    : instructions;

  return new ToolLoopAgent({
    id,
    model,
    instructions: fullInstructions,
    tools,
    stopWhen: stepCountIs(DEFAULT_MAX_STEPS),
  });
}

interface PersonalizationOptions {
  personaPrompt?: string;
  userContext?: string;
  emotionAdaptation?: string;
}

export function getAgent(
  intent: "CHAT" | "INTERVIEW" | "COURSE" | "EDITOR" | "SEARCH" | "SKILLS" | "STYLE",
  _sessionId?: string,
  personalization?: PersonalizationOptions,
) {
  // Build additional instructions from personalization data
  const additionalInstructions =
    personalization?.personaPrompt ||
    personalization?.userContext ||
    personalization?.emotionAdaptation
      ? [
          personalization.personaPrompt || "",
          personalization.userContext || "",
          personalization.emotionAdaptation || "",
        ]
          .filter((s) => s)
          .join("\n")
      : undefined;

  switch (intent) {
    case "INTERVIEW":
      return createAgent(
        "nexusnote-interview",
        aiProvider.chatModel,
        INSTRUCTIONS.interview,
        chatTools,
        additionalInstructions,
      );
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
    case "STYLE":
      return createAgent(
        "nexusnote-style",
        aiProvider.proModel,
        INSTRUCTIONS.style,
        styleTools,
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
