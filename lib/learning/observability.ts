import { env } from "@/config/env";
import { createTrace } from "@/lib/observability/trace";

interface LearnTracePayload {
  [key: string]: unknown;
}

function shouldLogLearnTrace(): boolean {
  return env.APP_TRACE_LOGS || env.LEARN_DEBUG_LOGS || env.NODE_ENV !== "production";
}

export function createLearnTrace(name: string, payload: LearnTracePayload = {}, traceId?: string) {
  return createTrace({
    channel: "LearnTrace",
    name,
    enabled: shouldLogLearnTrace(),
    payload,
    traceId,
  });
}
