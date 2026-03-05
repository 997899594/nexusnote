/**
 * AI Tools - 统一导出
 */

// 现有导出保持不变
export * from "./chat";
export * from "./editor";
export * from "./interview";
export * from "./learning";
export * from "./rag";
export * from "./skills";
export * from "./shared";

// 新增：工具构建器
import type { ToolContext } from "@/lib/ai/core/tool-context";
import { createNoteTools } from "./chat/notes";
import { createSearchTools } from "./chat/search";
import { createRagTools } from "./rag";
import { createInterviewTools } from "./interview";
import { createCourseTools } from "./learning/course";
import { createDiscoverSkillsTool } from "./skills/discovery";
import { suggestOptionsTool } from "./shared/suggest-options";
import { webSearchTool } from "./chat/web-search";
import { mindMapTool, summarizeTool } from "./learning/enhance";
import { editDocumentTool, batchEditTool, draftContentTool } from "./editor";

/**
 * 工具注册表
 */
export const toolRegistry = {
  global: {
    search: createSearchTools,
    rag: createRagTools,
    notes: createNoteTools,
  },
  resource: {
    interview: createInterviewTools,
    course: createCourseTools,
  },
  shared: {
    suggestOptions: suggestOptionsTool,
    webSearch: webSearchTool,
    mindMap: mindMapTool,
    summarize: summarizeTool,
    editDocument: editDocumentTool,
    batchEdit: batchEditTool,
    draftContent: draftContentTool,
  },
  skills: {
    discoverSkills: createDiscoverSkillsTool,
  },
} as const;

/**
 * 为 Agent 构建工具集
 */
export function buildAgentTools(
  agentType: "chat" | "interview" | "course" | "skills",
  ctx: ToolContext,
): Record<string, unknown> {
  const tools: Record<string, unknown> = {};

  // 共享工具 - 所有 Agent 都有
  Object.assign(tools, toolRegistry.shared);

  // 全局工具
  Object.assign(tools, toolRegistry.global.search(ctx));
  Object.assign(tools, toolRegistry.global.rag(ctx));

  switch (agentType) {
    case "chat":
      Object.assign(tools, toolRegistry.global.notes(ctx));
      break;

    case "interview":
      if (!ctx.resourceId) {
        throw new Error("Interview agent requires resourceId (courseId)");
      }
      Object.assign(tools, toolRegistry.resource.interview(ctx));
      break;

    case "course":
      if (!ctx.resourceId) {
        throw new Error("Course agent requires resourceId (courseId)");
      }
      Object.assign(tools, toolRegistry.resource.course(ctx));
      break;

    case "skills":
      Object.assign(tools, toolRegistry.skills.discoverSkills(ctx.userId));
      break;
  }

  return tools;
}
