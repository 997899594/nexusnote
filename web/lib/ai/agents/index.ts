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
) {
  return new ToolLoopAgent({
    id,
    model,
    instructions,
    tools,
    stopWhen: stepCountIs(DEFAULT_MAX_STEPS),
  });
}

export function getAgent(
  intent: "CHAT" | "INTERVIEW" | "COURSE" | "EDITOR" | "SEARCH",
  _sessionId?: string,
) {
  switch (intent) {
    case "INTERVIEW":
      return createAgent(
        "nexusnote-interview",
        aiProvider.chatModel,
        INSTRUCTIONS.interview,
        chatTools,
      );
    case "COURSE":
      return createAgent("nexusnote-course", aiProvider.proModel, INSTRUCTIONS.course, courseTools);
    default:
      return createAgent("nexusnote-chat", aiProvider.chatModel, INSTRUCTIONS.chat, chatTools);
  }
}
