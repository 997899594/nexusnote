# NexusNote Deployment Guide

NexusNote is deployed as a container image on a managed deployment platform.

This repository no longer carries:
- Helm charts
- ArgoCD / Flux manifests
- Cluster bootstrap scripts
- In-repo Kubernetes resource definitions

## Deployment model

```text
Code merged to main -> CI build -> image registry -> Juanie schema gate -> deployment platform rollout
```

## Container build strategy

- `Dockerfile.web` is the deployment source of truth
- the image is built with a multi-stage Docker build
- Next.js production build happens inside Docker, not on the CI host
- the runtime image only contains application runtime files; schema delivery is handled by Juanie from the repo config

## What the platform must provide

- Container runtime
- Environment variable injection
- Domain / HTTPS
- Health checks
- Postgres with pgvector
- Redis

## Required environment variables

Copy from `deploy/deploy.env.example` into your deployment platform.

Minimum required keys:
- `NODE_ENV`
- `NEXT_PUBLIC_APP_URL`
- `AUTH_URL`
- `AUTH_SECRET`
- `DATABASE_URL`
- `REDIS_URL`
- `AI_302_API_KEY`

Optional but recommended:
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `LANGFUSE_PUBLIC_KEY`
- `LANGFUSE_SECRET_KEY`

## Release flow

1. Push code
2. CI builds and publishes a new image from `Dockerfile.web`
3. Juanie reads `juanie.yaml` and exports the desired schema from `drizzle.config.mjs` at the target revision
4. Juanie applies the schema gate before rollout
5. Only after the gate is satisfied does the deployment platform roll out the new image
6. Verify `/api/health`, login, interview, and learn flow

## Schema sync policy

This repository treats Drizzle schema authoring as the repo-level schema contract for Juanie.
Schema application happens inside the Juanie preDeploy gate, not inside the runtime image.

- `juanie.yaml` declares `schema.source: drizzle`
- `drizzle.config.mjs` points Juanie at the Drizzle authoring config
- Juanie exports the desired schema directly from the repo at the release commit
- `juanie.yaml` declares `capabilities: [vector]` so the managed Postgres runtime includes pgvector before rollout
- `bun run db:push` remains the single local developer schema sync workflow

## Local development

`docker-compose.yml` is only for local development dependencies.
It is not a production deployment source of truth.
