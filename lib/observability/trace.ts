interface TracePayload {
  [key: string]: unknown;
}

interface CreateTraceOptions {
  channel: string;
  name: string;
  enabled: boolean;
  payload?: TracePayload;
  traceId?: string;
}

export interface AppTrace {
  traceId: string;
  step: (name: string, payload?: TracePayload) => void;
  finish: (payload?: TracePayload) => void;
  fail: (error: unknown, payload?: TracePayload) => void;
}

function emit(channel: string, event: string, enabled: boolean, payload: TracePayload): void {
  if (!enabled) {
    return;
  }

  console.log(`[${channel}] ${event}`, payload);
}

export function createTrace({
  channel,
  name,
  enabled,
  payload = {},
  traceId = crypto.randomUUID(),
}: CreateTraceOptions): AppTrace {
  const startedAt = Date.now();

  emit(channel, `${name}:start`, enabled, {
    traceId,
    ...payload,
  });

  return {
    traceId,
    step(stepName, stepPayload = {}) {
      emit(channel, `${name}:${stepName}`, enabled, {
        traceId,
        elapsedMs: Date.now() - startedAt,
        ...stepPayload,
      });
    },
    finish(finalPayload = {}) {
      emit(channel, `${name}:finish`, enabled, {
        traceId,
        elapsedMs: Date.now() - startedAt,
        ...finalPayload,
      });
    },
    fail(error, errorPayload = {}) {
      emit(channel, `${name}:error`, enabled, {
        traceId,
        elapsedMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
        ...errorPayload,
      });
    },
  };
}
