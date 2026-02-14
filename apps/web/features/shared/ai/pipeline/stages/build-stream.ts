/**
 * build-stream stage — 构建流式传输配置
 *
 * 中文分词 smooth stream 配置，提升流式输出的用户体验
 */

import { smoothStream } from "ai";
import type { PipelineStage } from "../types";

export const buildStreamStage: PipelineStage = {
  name: "build-stream",
  async execute(ctx) {
    const streamTransform = smoothStream({
      delayInMs: 20,
      chunking: new Intl.Segmenter("zh-CN", { granularity: "grapheme" }),
    });

    return { ...ctx, streamTransform };
  },
};
