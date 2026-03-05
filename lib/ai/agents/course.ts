/**
 * COURSE Agent - 课程内容生成
 */

import { stepCountIs, ToolLoopAgent, type ToolSet } from "ai";
import { aiProvider } from "../core";
import { createNoteTools } from "../tools/chat/notes";
import { createSearchTools } from "../tools/chat/search";
import { webSearchTool } from "../tools/chat/web-search";
import { batchEditTool, draftContentTool, editDocumentTool } from "../tools/editor";
import { createCourseTools } from "../tools/learning/course";
import { mindMapTool, summarizeTool } from "../tools/learning/enhance";
import { createRagTools } from "../tools/rag";
import type { PersonalizationOptions } from "./chat";

const INSTRUCTIONS = `你是课程内容生成助手。

根据用户提供的大纲主题，生成详细的课程内容。`;

/**
 * 创建 COURSE Agent
 */
export function createCourseAgent(options?: PersonalizationOptions) {
  const additionalInstructions = options
    ? [options.personaPrompt || "", options.userContext || ""].filter((s) => s).join("\n")
    : undefined;

  const fullInstructions = additionalInstructions
    ? `${additionalInstructions}\n\n${INSTRUCTIONS}`
    : INSTRUCTIONS;

  // 构建工具集 - 需要 userId 的工具使用工厂模式
  const courseTools: ToolSet = {
    // 笔记工具（需要 userId）
    ...createNoteTools(options?.userId || ""),
    // 搜索工具（需要 userId）
    ...createSearchTools(options?.userId || ""),
    // RAG 工具（需要 userId）
    ...createRagTools(options?.userId || ""),
    // 课程工具（需要 userId）
    ...createCourseTools(options?.userId || ""),
    // 其他工具（不需要 userId）
    webSearch: webSearchTool,
    mindMap: mindMapTool,
    summarize: summarizeTool,
    editDocument: editDocumentTool,
    batchEdit: batchEditTool,
    draftContent: draftContentTool,
  };

  return new ToolLoopAgent({
    id: "nexusnote-course",
    model: aiProvider.proModel,
    instructions: fullInstructions,
    tools: courseTools,
    stopWhen: stepCountIs(20),
  });
}
