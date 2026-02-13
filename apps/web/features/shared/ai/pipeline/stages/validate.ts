/**
 * validate stage — 检查 AI 配置是否就绪
 */

import { isAIConfigured } from "../../registry";
import type { PipelineContext, PipelineStage } from "../types";

export const validateStage: PipelineStage = {
  name: "validate",
  async execute(ctx) {
    if (!isAIConfigured()) {
      throw new Error("AI API key not configured");
    }
    return ctx;
  },
};
