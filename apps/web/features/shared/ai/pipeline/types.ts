/**
 * AI Pipeline 类型定义
 *
 * PipelineContext 是所有 stage 共享的上下文对象
 * 每个 PipelineStage 读取并写入 context，然后传递给下一个 stage
 */

import type { UIMessage } from "ai";
import type { AIContext } from "../gateway/service";

// ============================================
// Pipeline 上下文
// ============================================

export interface PipelineContext {
  /** 原始 UI 消息列表 */
  rawMessages: UIMessage[];
  /** 客户端传入的上下文配置 */
  context: AIContext;
  /** 用户 ID */
  userId: string;
  /** 链路追踪 ID */
  traceId: string;

  // —— 以下字段由各 stage 按需写入 ——

  /** 裁剪后的消息列表（prune stage 写入） */
  optimizedMessages?: UIMessage[];
  /** 提取的用户纯文本输入（extract stage 写入） */
  userInput?: string;
  /** 路由后的意图（route stage 写入） */
  intent?: string;
  /** RAG 检索上下文（enrich stage 写入） */
  ragContext?: string;
  /** 选中的 Agent 实例（select stage 写入） */
  agent?: unknown;
  /** Agent 调用选项（select stage 写入） */
  agentOptions?: Record<string, unknown>;
  /** 流式传输配置（build stage 写入） */
  streamTransform?: unknown;
}

// ============================================
// Pipeline Stage 接口
// ============================================

export interface PipelineStage {
  /** Stage 名称，用于日志和调试 */
  name: string;
  /** 执行 stage，返回更新后的 context */
  execute(ctx: PipelineContext): Promise<PipelineContext>;
}
