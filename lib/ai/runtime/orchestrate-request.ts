import type { UIMessage } from "ai";
import { classifyIntent } from "@/lib/ai/routing/classify-intent";
import { arbitrateRoute } from "@/lib/ai/routing/route-arbiter";
import type { RouteDecision } from "@/lib/ai/runtime/contracts";
import type { ResolvedRequestContext } from "./resolve-request-context";

export async function orchestrateRequest(params: {
  userId: string;
  messages: UIMessage[];
  requestContext: ResolvedRequestContext;
}): Promise<RouteDecision> {
  const classification = await classifyIntent({
    userId: params.userId,
    messages: params.messages,
    requestContext: params.requestContext,
  });

  return arbitrateRoute({
    requestContext: params.requestContext,
    classification,
  });
}
