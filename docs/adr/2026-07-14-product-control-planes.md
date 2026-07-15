# Product and Operations Control Planes

Date: 2026-07-14

## Status

Accepted.

## Context

NexusNote already has durable learning progress, transactional outbox delivery, AI usage records,
and structured RAG traces. The missing layer is not another feature surface. It is a shared control
plane that turns those durable records into product decisions, operational health, and adaptive AI
execution without changing the free-chat entitlement boundary.

## Decision

1. `learning_activity_events` is the canonical product event stream. Funnel projections and
   next-best-action state are derived on the server. Client analytics never becomes authoritative.
   Seven-day continuation means a new open or section completion at least seven days after start;
   early course completion remains a successful terminal outcome without fabricating retention.
2. Product events may be mirrored asynchronously to PostHog through the transactional outbox.
   Missing analytics configuration is an explicit no-op, not a product failure.
3. RAG observability keeps one trace identity across rewrite, retrieval, fusion, reranking, context
   compression, and the learning entry point. Provider traces are diagnostic detail inside that
   operation, not a second tracing system.
4. The PostgreSQL outbox has explicit pending, retrying, processed, and dead-letter states. Replay
   resets a dead-lettered event through an operator command and never mutates its payload.
5. Basic chat remains free and is never rejected by a daily cost budget. A soft governor can reduce
   model tier and context size within the user's selected model series when daily usage is elevated.
6. Operational SLOs are code-owned thresholds used by health checks and documented for release
   operators.

## Consequences

- Product metrics remain reproducible after analytics-provider changes.
- External analytics and downstream knowledge work share the same delivery failure model.
- Outbox poison events stop retrying indefinitely and become visible and replayable.
- Free chat has predictable cost behavior without introducing a new entitlement or quota.
- The application must maintain migration, worker, and monitoring compatibility as one release
  graph.
