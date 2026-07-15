# NexusNote Core Architecture Closure Implementation Plan

> **For Claude:** Execute each task in order and stop a later task from weakening an earlier
> release or security invariant.

**Goal:** Close the release, supply-chain, outbox, concurrency, and edge-protection gaps found in
the 2026-07-15 full-repository audit.

**Architecture:** Keep NexusNote as a modular monolith with separate web and worker runtimes.
PostgreSQL remains the authority for durable state and concurrency; Redis remains transport and
ephemeral streaming infrastructure. Juanie accepts GitHub Actions OIDC only through a scoped,
short-lived CI token exchange instead of receiving a GitHub API token.

**Tech Stack:** Next.js 16, TypeScript, Bun, Drizzle ORM, Atlas, PostgreSQL, BullMQ, GitHub Actions,
GitHub OIDC, JOSE.

---

### Task 1: Repair the release graph

**Files:**
- Modify: `juanie.yaml`
- Modify: `migrations/20260715068000_ai_cost_precision_contract.sql`
- Modify: `migrations/atlas.sum`
- Modify: `.github/workflows/juanie-ci.yml`

1. Point the release graph at the 2026-07-15 expand, backfill, verify, and cutover targets.
2. Keep `cost_cents` compatible with the old runtime during this rollout; defer its destructive
   removal to a later contract-only release.
3. Add a CI check that the runtime-required schema marker exists in the configured migration graph.
4. Run `bun run db:hash` and `bun run db:validate`.

### Task 2: Replace cross-boundary GitHub tokens with OIDC

**NexusNote files:**
- Modify: `.github/workflows/juanie-ci.yml`

**Juanie files:**
- Create: `src/lib/releases/ci-identity.ts`
- Create: `src/app/api/auth/ci/exchange/route.ts`
- Modify: `src/lib/releases/api-access.ts`
- Modify: `package.json`
- Modify: `bun.lock`

1. Grant the release job `id-token: write` and keep GHCR permissions separate.
2. Request a GitHub OIDC token with the `juanie-ci` audience.
3. Verify GitHub issuer, audience, repository, ref, and SHA claims in Juanie.
4. Exchange it for a one-hour Juanie JWT scoped to one repository/ref/SHA.
5. Accept the scoped Juanie token in release/status/artifact APIs while retaining provider-token
   fallback for non-GitHub integrations.
6. Run Juanie lint, typecheck, focused auth tests, and build.

### Task 3: Correct operations truth

**Files:**
- Modify: `lib/operations/outbox-operations.ts`
- Modify: `lib/health/runtime-health.ts`
- Modify: `lib/worker-runtime/heartbeat.ts`
- Modify: `docs/OPERATIONS_SLO.md`

1. Classify `product.learning_activity_recorded` as critical and
   `analytics.learning_activity_recorded` as non-critical analytics.
2. Make both lanes replayable while only the critical lane fails system health.
3. Use PostgreSQL statement timeouts for health queries instead of uncancelled `Promise.race`.
4. Report per-worker runtime identity rather than one overwrite-prone process row.

### Task 4: Make conversations and career runs concurrency-safe

**Files:**
- Modify: `db/schema/conversations.ts`
- Modify: `db/schema/career-tree.ts`
- Modify: `lib/chat/conversation-persistence.ts`
- Modify: `lib/chat/conversation-repository.ts`
- Modify: `lib/career-tree/runs.ts`
- Modify: career pipeline callers
- Create: Atlas expand/backfill/verify/cutover migrations for runtime invariants

1. Add a stable `message_id` and append messages with conflict-safe inserts; never replace the full
   conversation history from a client snapshot.
2. Move active stream state out of JSON metadata into typed conversation columns.
3. Acquire career runs through an atomic PostgreSQL lease with a fencing token.
4. Require the fencing token for success/failure writes and skip work when another worker owns the
   same idempotency key.
5. Enforce one latest course outline and one latest career snapshot with partial unique indexes.

### Task 5: Harden every request and provider boundary

**Files:**
- Modify: `lib/api/index.ts`
- Modify: billing webhook routes and provider clients
- Modify: auth email provider client
- Modify: `next.config.ts`
- Modify: `Dockerfile.web`
- Modify: `package.json` and `bun.lock`

1. Route JSON parsing through the bounded streaming body reader with endpoint-specific defaults.
2. Apply abort deadlines to every billing and email provider request.
3. Restrict checkout return URLs to the configured application origin.
4. Add a production CSP compatible with Next.js and the configured AI/telemetry endpoints.
5. Pin the worker Bun runtime to the builder version and remove vulnerable dependency lines where
   compatible releases exist.

### Task 6: Verification

Run in NexusNote:

```bash
bun run lint
bun run typecheck
bun run check:research-routing
bun run check:worker-runtime
bun run db:validate
SKIP_ENV_VALIDATION=true bun run build
bun audit --production
git diff --check
```

Run in Juanie:

```bash
bun run lint
bun run typecheck
bun test src/app/api/releases/__tests__/route.test.ts
bun run build
git diff --check
```
