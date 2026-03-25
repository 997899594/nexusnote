/**
 * AI Tools - 统一导出
 */

export * from "./chat";
export * from "./editor";
export * from "./learning";
export * from "./rag";

import type { ToolSet, UIMessage } from "ai";
import type { AgentProfile } from "@/lib/ai/core/capability-profiles";
import { createToolContext } from "@/lib/ai/core/tool-context";
import { createNoteTools } from "./chat/notes";
import { createSearchTools } from "./chat/search";
import { createWebSearchTool } from "./chat/web-search";
import { createLearnContextTools } from "./learn";
import { createEnhanceTools } from "./learning/enhance";
import { createRagTools } from "./rag";

interface ProfileToolBuilderInput {
  userId?: string;
  resourceId?: string;
  messages?: UIMessage[];
}

export function buildToolsForProfile(
  profile: AgentProfile,
  input: ProfileToolBuilderInput = {},
): ToolSet {
  switch (profile) {
    case "CHAT_BASIC":
      return {
        ...createWebSearchTool(input.userId),
      };
    case "LEARN_ASSIST": {
      const ctx = createToolContext({
        userId: input.userId,
        resourceId: input.resourceId,
        messages: input.messages,
      });
      return {
        ...createLearnContextTools(ctx),
        ...createRagTools(ctx.userId),
        ...createWebSearchTool(ctx.userId),
      };
    }
    case "NOTE_ASSIST": {
      const ctx = createToolContext({
        userId: input.userId,
        messages: input.messages,
      });
      return {
        ...createSearchTools(ctx.userId),
        ...createNoteTools(ctx.userId),
        ...createEnhanceTools(ctx.userId),
      };
    }
  }
}
