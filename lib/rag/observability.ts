import { env } from "@/config/env";
import { createTrace } from "@/lib/observability/trace";

interface RagTracePayload {
  [key: string]: unknown;
}

function shouldLogRagTrace(): boolean {
  return env.APP_TRACE_LOGS || env.RAG_DEBUG_LOGS || env.NODE_ENV !== "production";
}

export interface RagTrace {
  traceId: string;
  step: (name: string, payload?: RagTracePayload) => void;
  finish: (payload?: RagTracePayload) => void;
  fail: (error: unknown, payload?: RagTracePayload) => void;
}

export function createRagTrace(name: string, payload: RagTracePayload = {}): RagTrace {
  return createTrace({
    channel: "RAGTrace",
    name,
    enabled: shouldLogRagTrace(),
    payload,
  });
}
