/**
 * prune-messages stage — 消息裁剪（移除 reasoning、过期 tool calls、空消息）
 */

import { pruneUIMessages } from "../../ui-utils";
import type { PipelineContext, PipelineStage } from "../types";

export const pruneMessagesStage: PipelineStage = {
  name: "prune-messages",
  async execute(ctx) {
    const optimizedMessages = pruneUIMessages(ctx.rawMessages, {
      reasoning: "none",
      toolCalls: "before-last-3-messages",
      emptyMessages: "remove",
    });

    return { ...ctx, optimizedMessages };
  },
};
