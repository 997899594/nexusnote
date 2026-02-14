/**
 * route-intent stage — 意图路由（fast-path + LLM slow-path）
 *
 * 如果客户端传入了 explicitIntent，直接使用；
 * 否则通过 routeIntent() 进行 LLM 分类
 */

import { routeIntent } from "../../router/route";
import type { PipelineStage } from "../types";

export const routeIntentStage: PipelineStage = {
  name: "route-intent",
  async execute(ctx) {
    // 客户端已指定意图，直接使用
    let intent: string | undefined = ctx.context.explicitIntent;

    // 否则通过路由器分类
    if (!intent && ctx.userInput) {
      const routeResult = await routeIntent(
        ctx.userInput,
        JSON.stringify({
          isInInterview: ctx.context.isInInterview,
          hasDocumentOpen: ctx.context.hasDocumentOpen,
        }),
        ctx.traceId,
      );
      intent = routeResult.target;
    }

    return { ...ctx, intent: intent || "CHAT" };
  },
};
