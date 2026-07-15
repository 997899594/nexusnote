import { metrics } from "@opentelemetry/api";

const meter = metrics.getMeter("nexusnote.runtime", "2.0.0");

const aiRequestDuration = meter.createHistogram("nexusnote.ai.request.duration", {
  description: "AI request duration",
  unit: "ms",
});
const aiRequestCount = meter.createCounter("nexusnote.ai.request.count", {
  description: "AI request count",
});
const aiTokenCount = meter.createCounter("nexusnote.ai.tokens", {
  description: "AI tokens consumed",
  unit: "token",
});
const aiCost = meter.createCounter("nexusnote.ai.cost", {
  description: "Estimated AI cost",
  unit: "micro_usd",
});
const chatTimeToFirstToken = meter.createHistogram("nexusnote.chat.ttft", {
  description: "Time from chat request start to first visible text token",
  unit: "ms",
});
const outboxDeliveryDuration = meter.createHistogram("nexusnote.outbox.delivery.duration", {
  description: "Outbox event delivery latency from creation to terminal processing",
  unit: "ms",
});
const outboxDeliveryCount = meter.createCounter("nexusnote.outbox.delivery.count", {
  description: "Outbox delivery outcomes",
});

export function recordAIRequestMetric(input: {
  endpoint: string;
  model: string;
  success: boolean;
  durationMs?: number;
  inputTokens: number;
  outputTokens: number;
  costMicroUsd: number;
}): void {
  const attributes = {
    endpoint: input.endpoint,
    model: input.model,
    success: input.success,
  };
  aiRequestCount.add(1, attributes);
  if (input.durationMs !== undefined) aiRequestDuration.record(input.durationMs, attributes);
  aiTokenCount.add(input.inputTokens, { ...attributes, direction: "input" });
  aiTokenCount.add(input.outputTokens, { ...attributes, direction: "output" });
  aiCost.add(input.costMicroUsd, attributes);
}

export function recordChatTimeToFirstToken(endpoint: string, durationMs: number): void {
  chatTimeToFirstToken.record(durationMs, { endpoint });
}

export function recordOutboxDeliveryMetric(input: {
  lane: "critical" | "analytics";
  topic: string;
  outcome: "processed" | "failed" | "dead_lettered";
  durationMs: number;
}): void {
  const attributes = {
    lane: input.lane,
    topic: input.topic,
    outcome: input.outcome,
  };
  outboxDeliveryCount.add(1, attributes);
  outboxDeliveryDuration.record(input.durationMs, attributes);
}
