# NexusNote

AI-native learning workspace.

NexusNote 的主链不是“通用笔记”，而是：

`学习目标 -> 课程访谈 -> 课程生成 -> 章节学习 -> 学习对话 -> 笔记/沉淀 -> 技能成长`

[Documentation](./docs/README.md) · [Deployment Guide](./DEPLOYMENT.md) · [Contributing](./CONTRIBUTING.md)

## Stack

- Next.js 16 + React 19
- AI SDK v6
- Drizzle ORM + PostgreSQL + pgvector
- Redis + BullMQ
- Tiptap + Yjs + PartyKit
- Tailwind CSS 4
- Bun for package management and local development

## Current Product Focus

- AI interview for structured course planning
- course generation and section-based learning
- contextual learning chat
- note capture and knowledge distillation
- skill mapping and golden path progression

## Quick Start

```bash
bun install
docker compose up -d
cp .env.example .env
bun run db:push
bun dev
bun run worker:all
```

Local services:

- App: `http://localhost:3000`
- PostgreSQL: `localhost:5433`
- Redis: `localhost:6380`

`bun run db:push` 只用于本地开发数据库同步。生产发布不依赖在应用镜像内执行迁移命令。
需要后台任务时，请单独启动 `bun run worker:all`；web 进程不会再隐式托管 BullMQ workers。

## Common Commands

```bash
bun dev
bun run build
bun run start
bun run worker:all
bun run worker:research
bun run lint
bun run typecheck
bun run db:push
bun run db:studio
```

## Deployment

The repo ships a container-image workflow:

```text
代码合并到主分支 -> CI build -> image registry -> deployment platform rollout
```

- image build source of truth: `Dockerfile.web`
- web / worker runtime share one Docker build definition and split by target (`web`, `worker`)
- CI builds the image directly; it does not pre-package a `.docker-runtime` bundle
- platform-specific deployment config is intentionally not committed in this repository
- managed platforms should inject their own deployment contract during import or onboarding
- [`drizzle.config.mjs`](./drizzle.config.mjs) remains the schema authoring entry for local development and any platform-side schema inspection
- deployment notes: [deploy/README.md](./deploy/README.md)
- runtime env example: [deploy/deploy.env.example](./deploy/deploy.env.example)
- the runtime image does not ship repository schema files or migration scripts

`docker-compose.yml` is only for local dependencies and bootstraps pgvector on first local Postgres init.

## Docs

- [Docs Index](./docs/README.md)
- [AI System](./docs/AI.md)
- [Architecture 2026](./docs/ARCHITECTURE_2026.md)
- [PRD](./docs/PRD.md)
- [Next 16 Page Boundary Rules](./docs/NEXT16_PAGE_BOUNDARY_RULES.md)
- [RAG Performance and Observability](./docs/RAG_PERFORMANCE_AND_OBSERVABILITY.md)
