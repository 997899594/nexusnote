# Deployment Build Architecture

Date: 2026-04-08

## Requirements

- keep one deployment image as the source of truth
- remove CI host-side runtime repackaging
- keep Next.js `standalone` output for the web server
- keep schema delivery repo-driven through `juanie.yaml` + Drizzle schema authoring, not runtime shell commands

## Options Considered

1. Keep `.docker-runtime` and patch copy edge cases
2. Switch to a single multi-stage Docker build
3. Drop `standalone` and run `next start` from a full app image

## Decision

Choose option 2.

The builder stage installs dependencies with Bun and runs `bun run build` inside Docker.
The runner stage copies the built `standalone` output, static assets, and only the runtime files
the web app needs. Juanie applies schema changes from the repository contract declared by
`schema.source: drizzle` and `drizzle.config.mjs` by exporting the desired schema from the target repo revision, so the deployed
image no longer needs to carry deployment-time schema files or migration command behavior.
A small start wrapper keeps `npm start` valid in both the repo root
and the standalone image root. This removes host-specific packaging logic and keeps deployment
behavior aligned with what actually runs in production.

## Tradeoffs

- Pros: fewer moving parts, fewer host/CI path bugs, one image build path, simpler troubleshooting
- Cons: schema delivery now depends on Juanie correctly reading the repo config instead of an
  in-image fallback command

## Follow-up

- if image size becomes a real issue, keep trimming runtime-only copies further
- until then, prefer simpler and more predictable deployment behavior over smaller images
