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
import { createWebSearchTool } from "./chat/web-search";
import { batchEditTool, draftContentTool, editDocumentTool } from "./editor";
import { createInterviewTools } from "./interview";
import { createCourseTools } from "./learning/course";
import { createEnhanceTools } from "./learning/enhance";
import { createRagTools } from "./rag";
import { suggestOptionsTool } from "./shared/suggest-options";
import { createDiscoverSkillsTool } from "./skills/discovery";

/**
 * 工具注册表
 *
 * global: 工厂函数，接受 userId，返回工具对象
 * resource: 工厂函数，接受完整 ToolContext，返回工具对象
 * shared: 不依赖用户身份的纯功能工具（raw objects）
 * skills: 工厂函数，接受 userId
 */
export const toolRegistry = {
  global: {
    search: createSearchTools,
    rag: createRagTools,
    notes: createNoteTools,
    webSearch: createWebSearchTool,
    enhance: createEnhanceTools,
  },
  resource: {
    interview: createInterviewTools,
    course: createCourseTools,
  },
  shared: {
    suggestOptions: suggestOptionsTool,
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
 * - skills: 静默后台运行，只有 discoverSkills
 * - chat/interview/course: shared 编辑工具 + global 用户工具 + 特定工具
 */
export function buildAgentTools(
  agentType: "chat" | "interview" | "course" | "skills",
  ctx: ToolContext,
): Record<string, unknown> {
  const tools: Record<string, unknown> = {};

  // skills 是静默后台任务
  if (agentType === "skills") {
    Object.assign(tools, { discoverSkills: toolRegistry.skills.discoverSkills(ctx.userId) });
    return tools;
  }

  // 所有对话型 Agent 共有：编辑工具（无需 userId）+ 搜索/RAG/网页搜索/增强工具
  Object.assign(tools, toolRegistry.shared);
  Object.assign(tools, toolRegistry.global.search(ctx.userId));
  Object.assign(tools, toolRegistry.global.rag(ctx.userId));
  Object.assign(tools, toolRegistry.global.webSearch(ctx.userId));
  Object.assign(tools, toolRegistry.global.enhance(ctx.userId));

  switch (agentType) {
    case "chat":
      Object.assign(tools, toolRegistry.global.notes(ctx.userId));
      break;

    case "interview":
      if (!ctx.resourceId) {
        throw new Error("Interview agent requires resourceId (courseId)");
      }
      // 访谈 agent 只需要 confirmOutline + suggestOptions，不需要编辑/搜索等工具
      return {
        ...toolRegistry.resource.interview(ctx),
        suggestOptions: toolRegistry.shared.suggestOptions,
      } as Record<string, unknown>;

    case "course":
      Object.assign(tools, toolRegistry.global.notes(ctx.userId));
      Object.assign(tools, toolRegistry.resource.course(ctx.userId));
      break;
  }

  return tools;
}

