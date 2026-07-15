# Cache and Async Contract

NexusNote uses precise cache tags and explicit background work. The rule is simple:

`server loader owns cacheTag -> mutation reports a domain event -> worker/after handles follow-up work`

## Cache Ownership

- Server loaders call `"use cache"`, `cacheLife()`, and `cacheTag()`.
- Raw tag names and low-level tag revalidation live in `lib/cache/tags.ts`.
- Mutations must not assemble tag lists inline. They call domain invalidation helpers in
  `lib/cache/domain-events.ts`.
- Domain helpers are named by product event, not by implementation detail:
  - `revalidateCourseCreationViews`
  - `revalidateCourseContentViews`
  - `revalidateCourseProgressViews`
  - `revalidateNoteWorkspaceViews`
  - `revalidateKnowledgeWorkspaceViews`
  - `revalidateCareerTreeViews`
  - `revalidateConversationViews`

This keeps page cache behavior reviewable without searching every route handler and worker.

## Async Work

Use the smallest async mechanism that matches the contract:

- `after()` is for best-effort follow-up that can run after the response and does not need retry
  orchestration.
- BullMQ is for retryable, long-running, or worker-owned jobs.
- Route handlers may enqueue jobs, but workers own job execution and retries.
- Web runtime must not implicitly start BullMQ workers.

Current examples:

- Course revision and learning completion write `domain_outbox_events` in the same PostgreSQL
  transaction as their authoritative state.
- The learning outbox worker dispatches through BullMQ and owns knowledge evidence, aggregation,
  career-tree updates, retries, and idempotency.
- Product analytics consumes the same learning event stream through an optional outbox projection;
  clients never double-write analytics events.
- Outbox delivery has explicit retry and dead-letter states. Critical dead letters fail holistic
  health; operators replay immutable payloads with `bun run outbox:replay <event-uuid>`.
- Course section production writes materialized content, enqueues RAG indexing, invalidates the
  chapter Redis cache, then revalidates the learn page domain view.

## Redis Boundary

Redis is runtime state, not authoritative product data.

- Use Redis for BullMQ, locks, live stream state, and short-lived generated-content caches.
- Use PostgreSQL for durable domain state and queryable history.
- Do not use Redis TTL caches as a replacement for Next cache tags on page data.

## Review Checklist

When adding or changing a mutation:

1. Identify the durable data that changed.
2. Add or reuse the matching domain invalidation helper.
3. Put retryable work in BullMQ.
4. Use `after()` only for non-critical follow-up that can safely run after the response.
5. Keep server loaders responsible for their own `cacheTag()` declarations.
