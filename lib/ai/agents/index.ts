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
  assessComplexityTool,
  confirmOutlineTool,
  createCourseProfileTool,
  proposeOutlineTool,
  suggestOptionsTool,
  updateProfileTool,
} from "../tools/interview";
import {
  checkCourseProgressTool,
  generateCourseTool,
  mindMapTool,
  summarizeTool,
} from "../tools/learning";
import { hybridSearchTool } from "../tools/rag";
import { discoverSkillsTool } from "../tools/skills";
import { analyzeStyleTool } from "../tools/style";

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

  interview: `你是 NexusNote 的课程规划师。

## 核心任务
通过自然对话了解用户的学习需求，生成个性化的课程大纲。

## 重要：必须生成文本回复
每次回复都必须包含友好的文字内容，不要只调用工具。用户看到的应该是你的对话，而不是工具执行结果。

## 工作流程

### 第一轮：欢迎 + 评估
1. **先用文字回复用户**：确认学习主题，表示帮助意愿
2. 调用 assessComplexity 评估复杂度
3. 调用 createCourseProfile 创建画像（使用提供的 userId）
4. **用文字提出第一个问题**
5. 调用 suggestOptions 展示选项

### 复杂度对应的访谈深度
- trivial: 直接 proposeOutline（如：炒西红柿）
- simple: 1 轮确认后 proposeOutline（如：做 PPT）
- moderate: 2-3 轮（如：Python 入门）
- complex: 4-5 轮（如：考研数学）
- expert: 5-6 轮（如：机器学习）

### 每轮必须
1. **先用文字回应**：确认或反馈用户上一轮的选择
2. 调用 updateProfile 更新收集的信息
3. **用文字提出下一个问题**
4. 调用 suggestOptions 展示 3-4 个简洁选项

### 访谈完成
当收集足够信息时，调用 proposeOutline 生成大纲。

## 行为准则

1. **先说话，再调工具**：用户先看到你的文字
2. **友好自然**：像朋友聊天，不要审问式
3. **简洁高效**：每个问题都有明确目的
4. **自适应**：简单主题快速通过，复杂主题深入

## 示例回复格式
"太好了，学 Python 是个不错的选择！让我先了解一下你的情况..."
[调用 assessComplexity]
[调用 createCourseProfile]
"你之前有编程经验吗？"
[调用 suggestOptions: "完全新手", "学过一点", "会其他语言"]`,

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

const styleTools = {
  analyzeStyle: analyzeStyleTool,
} as ToolSet;

const courseTools = {
  ...chatTools,
  generateCourse: generateCourseTool,
  checkCourseProgress: checkCourseProgressTool,
} as ToolSet;

const interviewTools = {
  assessComplexity: assessComplexityTool,
  createCourseProfile: createCourseProfileTool,
  updateProfile: updateProfileTool,
  suggestOptions: suggestOptionsTool,
  proposeOutline: proposeOutlineTool,
  confirmOutline: confirmOutlineTool,
} as ToolSet;

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
    stopWhen: stopWhen ?? stepCountIs(DEFAULT_MAX_STEPS),
  });
}

interface PersonalizationOptions {
  personaPrompt?: string;
  userContext?: string;
  emotionAdaptation?: string;
  interviewContext?: string;
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
    personalization?.emotionAdaptation ||
    personalization?.interviewContext
      ? [
          personalization.personaPrompt || "",
          personalization.userContext || "",
          personalization.emotionAdaptation || "",
          personalization.interviewContext || "",
        ]
          .filter((s) => s)
          .join("\n")
      : undefined;

  switch (intent) {
    case "INTERVIEW":
      return createAgent(
        "nexusnote-interview",
        aiProvider.proModel, // 使用 Pro 模型进行访谈
        INSTRUCTIONS.interview,
        interviewTools,
        additionalInstructions,
        // 只在达到最大轮数时停止
        // suggestOptions 和 proposeOutline 不暂停，AI 继续生成文字
        stepCountIs(INTERVIEW_MAX_STEPS),
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
