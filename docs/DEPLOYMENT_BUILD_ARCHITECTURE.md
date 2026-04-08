# Deployment Build Architecture

Date: 2026-04-08

## Requirements

- keep one deployment image as the source of truth
- remove CI host-side runtime repackaging
- keep Next.js `standalone` output for the web server
- preserve the ability to run the `db:push` script from the deployed image

## Options Considered

1. Keep `.docker-runtime` and patch copy edge cases
2. Switch to a single multi-stage Docker build
3. Drop `standalone` and run `next start` from a full app image

## Decision

Choose option 2.

The builder stage installs dependencies with Bun and runs `bun run build` inside Docker.
The runner stage copies the built `standalone` output, static assets, and the files required for
schema sync. A small start wrapper keeps `npm start` valid in both the repo root and the
standalone image root. This removes host-specific packaging logic and keeps deployment behavior
aligned with what actually runs in production.

## Tradeoffs

- Pros: fewer moving parts, fewer host/CI path bugs, one image build path, simpler troubleshooting
- Cons: runner image is larger because it retains `node_modules` for schema sync

## Follow-up

- if image size becomes a real issue, split web and migration into separate targets later
- until then, prefer simpler and more predictable deployment behavior over smaller images
