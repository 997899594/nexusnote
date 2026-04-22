# Contributing

## Ground Rules

- Use `bun`, not `npm` or `pnpm`
- Keep changes small and focused
- Do not commit secrets, `.env`, or deployment credentials
- Run `bun run lint` and `bun run typecheck` before opening a PR
- Run `SKIP_ENV_VALIDATION=true bun run build` for changes that affect routing, config, or AI/runtime wiring

## Repo Boundaries

- `docs/` root is for active documentation only
- Historical plans, one-off specs, and old reference material belong in `docs/archive/`
- Do not add local assistant state or private workspace files to the repo

Examples that should stay out of git:

- `.agents/`
- `.claude/`
- `.codex/`
- ad-hoc scratch plans
- local environment snapshots

## Docs Rules

- Update [docs/README.md](/Users/findbiao/projects/nexusnote/docs/README.md) when adding a new active doc
- Prefer updating an existing active doc over creating another overlapping one
- If a document stops guiding current implementation, move it to `docs/archive/`

## Config Rules

- `docker-compose.yml` is only for local dependencies
- deployment runtime config examples live in `deploy/`
- platform-specific deployment contracts should be injected during import or onboarding, not committed in this repo
- keep CI aligned with `docker-bake.hcl` and `Dockerfile.web`
- do not commit instance-specific platform exports or generated env snapshots

## AI Rules

- Follow [AGENTS.md](/Users/findbiao/projects/nexusnote/AGENTS.md)
- Follow [docs/AI.md](/Users/findbiao/projects/nexusnote/docs/AI.md)
- Keep static prompt resources in `lib/ai/prompts/resources/`
- Do not introduce legacy parallel AI paths when extending the current stack
