# ADR: Worker Runtime Contract

## Status

Accepted

## Context

NexusNote runs web traffic and queue workers as separate Juanie services. Worker processes execute
course production, career tree, knowledge insights, RAG indexing, and research jobs. Those workers
must not import Next.js web-runtime-only modules such as `server-only`, `next/cache`, or
`next/server`.

The worker image is deployed from a bundled Bun runtime artifact. CI needs to prove two things before
Juanie deploys the image:

- The production worker bundle does not contain web-runtime-only modules.
- A worker runtime contract can be loaded in a clean CI environment without production secrets.

CI must not rely on fake `DATABASE_URL`, `REDIS_URL`, or AI provider keys. It also must not add test
branches to the production worker entrypoint.

## Decision

Worker runtime code is split into three explicit layers:

- `lib/worker-runtime/runtime.ts`: production runtime lifecycle, signal handling, worker shutdown,
  and DB/Redis cleanup.
- `lib/worker-runtime/registry.ts` and `lib/worker-runtime/queue-runtime.ts`: queue worker
  definitions and lazy worker-module resolution.
- `scripts/probe-worker-runtime.ts`: CI-only runtime contract probe. It validates the registry shape
  and can be bundled and executed without importing DB, Redis, queue workers, or AI providers.

Production entrypoints such as `scripts/start-workers.ts` only start workers. They must not contain
smoke-test flags, fake-environment branches, or CI-specific exits.

`scripts/check-worker-runtime-boundary.ts` builds both the production worker bundle and the probe
bundle, scans all generated JavaScript for forbidden web-runtime modules, then executes only the
probe bundle in a minimal environment.

## Consequences

- Production startup remains direct and readable.
- CI can validate the worker runtime boundary without production secrets.
- Worker module imports stay lazy behind the runtime registry, so contract probes do not initialize
  DB/Redis/AI clients.
- Adding a new queue worker requires updating the registry and the boundary-check source list.
- The bundle scanner is intentionally conservative; if a forbidden module appears in generated
  worker JavaScript, CI fails before deployment.
