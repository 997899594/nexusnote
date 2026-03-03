/**
 * CHAT Agent - 通用对话
 */

import { stepCountIs, ToolLoopAgent, type ToolSet } from "ai";
import { aiProvider } from "../core";
import {
  createNoteTools,
  createNoteTool,
  deleteNoteTool,
  getNoteTool,
  searchNotesTool,
  updateNoteTool,
  webSearchTool,
} from "../tools/chat";
import { batchEditTool, draftContentTool, editDocumentTool } from "../tools/editor";
import { mindMapTool, summarizeTool } from "../tools/learning";
import { hybridSearchTool } from "../tools/rag";

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
} as const;

export interface PersonalizationOptions {
  personaPrompt?: string;
  userContext?: string;
  userId?: string;
}

/**
 * 创建 CHAT Agent
 */
export function createChatAgent(options?: PersonalizationOptions) {
  const additionalInstructions = options
    ? [options.personaPrompt || "", options.userContext || ""].filter((s) => s).join("\n")
    : undefined;

  const fullInstructions = additionalInstructions
    ? `${additionalInstructions}\n\n${INSTRUCTIONS.chat}`
    : INSTRUCTIONS.chat;

  // 构建 chatTools - 如果有 userId，使用带权限验证的笔记工具
  const chatTools = {
    ...(options?.userId
      ? createNoteTools(options.userId)
      : {
          createNote: createNoteTool,
          getNote: getNoteTool,
          updateNote: updateNoteTool,
          deleteNote: deleteNoteTool,
        }),
    // 其他工具不变
    searchNotes: searchNotesTool,
    hybridSearch: hybridSearchTool,
    webSearch: webSearchTool,
    mindMap: mindMapTool,
    summarize: summarizeTool,
    editDocument: editDocumentTool,
    batchEdit: batchEditTool,
    draftContent: draftContentTool,
  } as ToolSet;

  return new ToolLoopAgent({
    id: "nexusnote-chat",
    model: aiProvider.chatModel,
    instructions: fullInstructions,
    tools: chatTools,
    stopWhen: stepCountIs(20),
  });
}

// 导出工具供外部使用（deprecated - 推荐使用 createChatAgent 传入 userId）
export const chatTools = {
  createNote: createNoteTool,
  getNote: getNoteTool,
  updateNote: updateNoteTool,
  deleteNote: deleteNoteTool,
  searchNotes: searchNotesTool,
  hybridSearch: hybridSearchTool,
  webSearch: webSearchTool,
  mindMap: mindMapTool,
  summarize: summarizeTool,
  editDocument: editDocumentTool,
  batchEdit: batchEditTool,
  draftContent: draftContentTool,
} as ToolSet;
