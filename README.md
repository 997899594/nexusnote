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
bun run db:migrate
bun dev
```

Local services:

- App: `http://localhost:3000`
- PostgreSQL: `localhost:5433`
- Redis: `localhost:6380`

## Common Commands

```bash
bun dev
bun run build
bun run start
bun run lint
bun run typecheck
bun run db:migrate
bun run db:studio
```

## Deployment

The repo ships a container-image workflow:

```text
代码合并到主分支 -> CI build -> image registry -> Juanie preDeploy migration gate -> deployment platform rollout
```

- image build source of truth: `Dockerfile.web`
- CI builds the image directly; it does not pre-package a `.docker-runtime` bundle
- deployment migration gate uses the `db:migrate` command
- platform config: [juanie.yaml](./juanie.yaml)
- deployment notes: [deploy/README.md](./deploy/README.md)
- runtime env example: [deploy/deploy.env.example](./deploy/deploy.env.example)

`docker-compose.yml` is only for local dependencies.

## Docs

- [Docs Index](./docs/README.md)
- [AI System](./docs/AI.md)
- [Architecture 2026](./docs/ARCHITECTURE_2026.md)
- [PRD](./docs/PRD.md)
- [Next 16 Page Boundary Rules](./docs/NEXT16_PAGE_BOUNDARY_RULES.md)
- [RAG Performance and Observability](./docs/RAG_PERFORMANCE_AND_OBSERVABILITY.md)
