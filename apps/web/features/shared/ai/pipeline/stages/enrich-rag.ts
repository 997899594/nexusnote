/**
 * enrich-rag stage — RAG 上下文注入
 *
 * 仅在 CHAT 意图且启用了 RAG 时触发
 * 其他意图（INTERVIEW, COURSE_GENERATION 等）跳过
 */

import { ragService } from "../../rag";
import type { PipelineContext, PipelineStage } from "../types";

export const enrichRAGStage: PipelineStage = {
  name: "enrich-rag",
  async execute(ctx) {
    // 只有 CHAT 意图 + 启用 RAG + 有用户输入时才执行检索
    const shouldEnrich =
      ctx.intent === "CHAT" &&
      ctx.context.enableRAG &&
      ctx.userInput;

    if (!shouldEnrich) {
      return ctx;
    }

    const ragResult = await ragService.search(ctx.userInput!, ctx.userId);
    return { ...ctx, ragContext: ragResult.context || undefined };
  },
};
