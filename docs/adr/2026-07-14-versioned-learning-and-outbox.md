# Versioned Learning and Transactional Outbox

Date: 2026-07-14

## Decision

NexusNote treats every private outline revision and public publication snapshot as immutable learning
content. `learning_enrollments` identifies the exact revision a user is learning, and
`learning_section_completions` is the only persisted completion fact. Chapter completion, resume
position, progress percentage, and course completion presentation are derived projections.

Outline nodes have stable semantic UUIDs. A new revision only inherits an ID when the chapter and
section titles match exactly after normalization. The system never uses fuzzy matching to silently
transfer progress. Old section documents and annotations remain attached to their immutable
revision.

Critical downstream work uses `domain_outbox_events`. Course revision and section completion
transactions append an outbox event in PostgreSQL. The independent worker runtime dispatches these
events through BullMQ and performs idempotent knowledge-evidence and career-tree updates. `after()`
is restricted to disposable response follow-up and is not part of a durable product workflow.

Public social capabilities remain in scope: discovery, subscriptions, likes, urges, public
annotations, and owner moderation are retained. This decision does not add ranking, recommendation,
governance, or creator-incentive systems.

## Release Contract

`bun run db:push` applies the idempotent data transition before Drizzle schema synchronization. The
transition rewrites existing progress, activity events, publication snapshots, and public annotation
section references before removing legacy progress tables. `/api/health` requires the registered
schema release, critical tables, the expected pgvector/HNSW contract, Redis, and a current worker
heartbeat.

## Consequences

- Course regeneration no longer deletes prior content, progress, highlights, or notes.
- Public progress never crosses snapshot boundaries implicitly.
- All learning surfaces share one enrollment and completion model.
- Progress JSON arrays and persisted chapter cursors no longer exist.
- Worker availability is part of production readiness because learning projections are durable but
  asynchronous.
