/**
 * CHAT Agent - 通用对话
 */

import { stepCountIs, ToolLoopAgent, type ToolSet } from "ai";
import { aiProvider } from "../core";
import { createNoteTools } from "../tools/chat/notes";
import { createSearchTools } from "../tools/chat/search";
import { webSearchTool } from "../tools/chat/web-search";
import { batchEditTool, draftContentTool, editDocumentTool } from "../tools/editor";
import { mindMapTool, summarizeTool } from "../tools/learning/enhance";
import { createRagTools } from "../tools/rag";

const INSTRUCTIONS = `你是 NexusNote 智能助手。

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
- 使用工具获取信息，不要编造`;

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
    ? `${additionalInstructions}\n\n${INSTRUCTIONS}`
    : INSTRUCTIONS;

  // 构建工具集 - 需要 userId 的工具使用工厂模式
  const chatTools: ToolSet = {
    // 笔记工具（需要 userId）
    ...createNoteTools(options?.userId || ""),
    // 搜索工具（需要 userId）
    ...createSearchTools(options?.userId || ""),
    // RAG 工具（需要 userId）
    ...createRagTools(options?.userId || ""),
    // 其他工具（不需要 userId）
    webSearch: webSearchTool,
    mindMap: mindMapTool,
    summarize: summarizeTool,
    editDocument: editDocumentTool,
    batchEdit: batchEditTool,
    draftContent: draftContentTool,
  };

  return new ToolLoopAgent({
    id: "nexusnote-chat",
    model: aiProvider.chatModel,
    instructions: fullInstructions,
    tools: chatTools,
    stopWhen: stepCountIs(20),
  });
}
