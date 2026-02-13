/**
 * extract-input stage — 从 UIMessage 提取纯文本用户输入
 */

import { convertToModelMessages } from "ai";
import type { PipelineContext, PipelineStage } from "../types";

export const extractInputStage: PipelineStage = {
  name: "extract-input",
  async execute(ctx) {
    const modelMessages = await convertToModelMessages(ctx.rawMessages);
    const lastUserMsg = modelMessages.filter((m) => m.role === "user").pop();

    let userInput = "";
    if (lastUserMsg && typeof lastUserMsg.content === "string") {
      userInput = lastUserMsg.content;
    } else if (lastUserMsg && Array.isArray(lastUserMsg.content)) {
      userInput = lastUserMsg.content
        .filter((p) => p.type === "text")
        .map((p) => (p.type === "text" ? p.text : ""))
        .join("");
    }

    return { ...ctx, userInput };
  },
};
