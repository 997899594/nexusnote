# Runtime Control Plane Modernization

## Objective

Close the gap between NexusNote's documented control planes and runtime behavior without adding
new product scope. Basic chat remains free. Entitlements continue to apply only to course
generation and research. Existing social capabilities remain unchanged.

## Architecture

### Conversation Input Boundary

All conversational routes consume a shared boundary that limits raw request bytes before JSON
parsing, validates the request envelope with Zod, validates AI SDK v6 `UIMessage` structures, and
enforces message, part, file, and estimated-token budgets. Routes receive validated messages and
never cast unknown input to `UIMessage[]`.

### Queue Runtime Policy

A typed `QueueRuntimePolicy` is the only runtime source for queue concurrency, attempts, and
backoff. Environment validation owns deploy-time configuration. Compile-time defaults only supply
environment defaults and are never read directly by queue or worker modules.

### Outbox Delivery Lanes

The learning outbox dispatcher routes critical domain work and analytics export to separate BullMQ
queues. Critical learning activity updates a rebuildable activation projection, then creates a
separate analytics delivery event. The analytics worker batches PostHog events and cannot consume
critical worker capacity.

### Activation Projection

`learning_activation_projections` stores milestone timestamps per user and course. Raw learning
events remain canonical. Outbox handlers update projections idempotently, and a rebuild command can
recreate them from raw events. Product reads and cohort reports query the projection instead of
reconstructing journeys on every request.

### AI Policy And Observability

Economy is a first-class model role for every model series. Free-chat compaction uses both message
count and estimated-token budgets. AI cost is stored in micro-USD with the pricing snapshot used for
the calculation. OpenTelemetry instruments request duration, time to first token, token usage,
cost, queue delivery latency, and failures.

### Module Ownership

Large modules are split by durable capability boundaries: research provider adapters, extraction,
ranking and orchestration; career-tree evidence, composition and persistence; course-reader shell,
annotations and access policy. Public and private readers share presentation primitives but retain
separate authorization policies.

## Failure Semantics

Malformed or oversized conversational requests fail before model routing. Redis rate limiting uses
a bounded in-process emergency limiter during Redis outages. Critical outbox delivery retries and
dead-letters independently from analytics export. Projection writes are idempotent and raw events
remain replayable.

## Verification

No test framework is introduced in this phase. Verification consists of Biome, TypeScript checks,
worker-boundary checks, schema migration validation, and a production build.
