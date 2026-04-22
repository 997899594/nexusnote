# NexusNote Deployment Guide

NexusNote is deployed as a container image on a managed deployment platform.

This repository no longer carries:
- Helm charts
- ArgoCD / Flux manifests
- Cluster bootstrap scripts
- In-repo Kubernetes resource definitions

## Deployment model

```text
Code merged to main -> CI build -> image registry -> deployment platform rollout
```

## Container build strategy

- `Dockerfile.web` is the deployment source of truth
- the image is built with a multi-stage Docker build
- Next.js production build happens inside Docker, not on the CI host
- the runtime image only contains application runtime files; deployment-time schema application should be handled by the target platform, not by in-image fallback commands

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
3. Import or sync the repo into your deployment platform so it can inject its own deployment contract
4. Let the platform validate or apply schema changes using `drizzle.config.mjs` if it supports repo-side schema inspection
5. Roll out the new image
6. Verify `/api/health`, login, interview, and learn flow

## Schema sync policy

This repository treats Drizzle schema authoring as the repo-level schema contract.
Schema application should happen in the deployment platform's release gate, not inside the runtime image.

- `drizzle.config.mjs` is the canonical authoring config for schema inspection
- managed platforms can inspect the repo at the target revision instead of relying on runtime migration commands
- platform-specific capabilities such as pgvector should be declared in the platform contract injected during import
- `bun run db:push` remains the single local developer schema sync workflow

## Local development

`docker-compose.yml` is only for local development dependencies.
It is not a production deployment source of truth.
