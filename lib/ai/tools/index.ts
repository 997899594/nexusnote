/**
 * AI Tools - 统一导出
 */

// 现有导出保持不变
export * from "./chat";
export * from "./editor";
export * from "./interview";
export * from "./learning";
export * from "./rag";
export * from "./shared";
export * from "./skills";

// 新增：工具构建器
import type { ToolContext } from "@/lib/ai/core/tool-context";
import { createNoteTools } from "./chat/notes";
import { createSearchTools } from "./chat/search";
import { webSearchTool } from "./chat/web-search";
import { batchEditTool, draftContentTool, editDocumentTool } from "./editor";
import { createInterviewTools } from "./interview";
import { createCourseTools } from "./learning/course";
import { mindMapTool, summarizeTool } from "./learning/enhance";
import { createRagTools } from "./rag";
import { suggestOptionsTool } from "./shared/suggest-options";
import { createDiscoverSkillsTool } from "./skills/discovery";

/**
 * 工具注册表
 *
 * 注意：resource 目录下的工具使用 ToolContext
 *      其他工具暂时使用 string (userId)
 */
export const toolRegistry = {
  global: {
    search: createSearchTools,
    rag: createRagTools,
    notes: createNoteTools,
  },
  resource: {
    interview: createInterviewTools,
    // course: createCourseTools, // TODO: 迁移到 ToolContext
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
 *
 * 注意：不同类型的 Agent 有不同的工具需求
 * - chat/interview/course: 需要 shared 交互工具
 * - skills: 静默后台运行，只需要 discoverSkills
 */
export function buildAgentTools(
  agentType: "chat" | "interview" | "course" | "skills",
  ctx: ToolContext,
): Record<string, unknown> {
  const tools: Record<string, unknown> = {};

  // skills 是静默后台任务，只需要 discoverSkills
  if (agentType === "skills") {
    Object.assign(tools, toolRegistry.skills.discoverSkills(ctx.userId));
    return tools;
  }

  // 其他 Agent: 共享工具 + 全局工具
  Object.assign(tools, toolRegistry.shared);
  Object.assign(tools, toolRegistry.global.search(ctx.userId));
  Object.assign(tools, toolRegistry.global.rag(ctx.userId));

  switch (agentType) {
    case "chat":
      Object.assign(tools, toolRegistry.global.notes(ctx.userId));
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
      // course tools still use string signature
      Object.assign(tools, createCourseTools(ctx.userId));
      break;
  }

  return tools;
}
