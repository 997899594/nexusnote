/**
 * AI Pipeline — 可组合的请求处理管道
 *
 * 设计思路：
 * 1. 每个 stage 独立、可测试、可插拔
 * 2. 通过 PipelineContext 共享上下文
 * 3. 不同场景可以组合不同的 pipeline（如 editor 模式跳过 RAG）
 * 4. 新增功能只需插入新 stage，不改现有代码
 */

import { createAgentUIStreamResponse } from "ai";
import type { PipelineContext, PipelineStage } from "./types";
import { buildStreamStage } from "./stages/build-stream";
import { enrichRAGStage } from "./stages/enrich-rag";
import { extractInputStage } from "./stages/extract-input";
import { pruneMessagesStage } from "./stages/prune-messages";
import { routeIntentStage } from "./stages/route-intent";
import { selectAgentStage } from "./stages/select-agent";
import { validateStage } from "./stages/validate";

// ============================================
// Pipeline 核心
// ============================================

export class AIPipeline {
  private stages: PipelineStage[];

  constructor(stages: PipelineStage[]) {
    this.stages = stages;
  }

  /**
   * 按顺序执行所有 stage，然后构建流式响应
   */
  async execute(initial: PipelineContext): Promise<Response> {
    let ctx = initial;

    for (const stage of this.stages) {
      ctx = await stage.execute(ctx);
    }

    // 所有 stage 执行完毕，构建流式响应
    // agent 和 streamTransform 类型是 unknown（因为 pipeline 是通用的），
    // 但在运行时由 select-agent 和 build-stream stage 保证正确类型
    return createAgentUIStreamResponse({
      agent: ctx.agent as Parameters<typeof createAgentUIStreamResponse>[0]["agent"],
      uiMessages: ctx.optimizedMessages || ctx.rawMessages,
      options: ctx.agentOptions,
      experimental_transform: ctx.streamTransform as Parameters<typeof createAgentUIStreamResponse>[0]["experimental_transform"],
    });
  }

  /**
   * 在指定 stage 之后插入新 stage
   */
  insertAfter(afterName: string, stage: PipelineStage): AIPipeline {
    const idx = this.stages.findIndex((s) => s.name === afterName);
    if (idx === -1) {
      throw new Error(`Stage "${afterName}" not found`);
    }
    const newStages = [...this.stages];
    newStages.splice(idx + 1, 0, stage);
    return new AIPipeline(newStages);
  }

  /**
   * 替换指定名称的 stage
   */
  replace(name: string, stage: PipelineStage): AIPipeline {
    const newStages = this.stages.map((s) => (s.name === name ? stage : s));
    return new AIPipeline(newStages);
  }
}

// ============================================
// 默认 Pipeline 实例
// ============================================

export const defaultPipeline = new AIPipeline([
  validateStage,
  extractInputStage,
  pruneMessagesStage,
  routeIntentStage,
  enrichRAGStage,
  selectAgentStage,
  buildStreamStage,
]);

// ============================================
// Re-exports
// ============================================

export type { PipelineContext, PipelineStage } from "./types";
export { validateStage } from "./stages/validate";
export { extractInputStage } from "./stages/extract-input";
export { pruneMessagesStage } from "./stages/prune-messages";
export { routeIntentStage } from "./stages/route-intent";
export { enrichRAGStage } from "./stages/enrich-rag";
export { selectAgentStage } from "./stages/select-agent";
export { buildStreamStage } from "./stages/build-stream";
