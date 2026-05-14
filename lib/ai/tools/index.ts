import type { ToolSet, UIMessage } from "ai";
import { createToolContext } from "@/lib/ai/core/tool-context";
import type { ConversationCapabilityMode } from "@/lib/ai/runtime/contracts";
import { createCareerContextTools } from "./career/context";
import { createNoteTools } from "./chat/notes";
import { createSearchTools } from "./chat/search";
import { createWebSearchTool } from "./chat/web-search";
import { createLearnContextTools } from "./learning/context";
import { createEnhanceTools } from "./learning/enhance";
import { createRagTools } from "./rag";

interface CapabilityModeToolBuilderInput {
  userId?: string;
  resourceId?: string;
  messages?: UIMessage[];
}

export function buildToolsForCapabilityMode(
  capabilityMode: ConversationCapabilityMode,
  input: CapabilityModeToolBuilderInput = {},
): ToolSet {
  switch (capabilityMode) {
    case "general_chat":
      return {
        ...createWebSearchTool(input.userId),
      };
    case "learn_coach": {
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
    case "note_assistant": {
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
    case "research_assistant": {
      const ctx = createToolContext({
        userId: input.userId,
        messages: input.messages,
      });
      return {
        ...createSearchTools(ctx.userId),
        ...createRagTools(ctx.userId),
        ...createWebSearchTool(ctx.userId),
      };
    }
    case "career_guide": {
      const ctx = createToolContext({
        userId: input.userId,
        messages: input.messages,
      });
      return {
        ...createCareerContextTools(ctx.userId),
        ...createSearchTools(ctx.userId),
        ...createRagTools(ctx.userId),
      };
    }
  }
}
