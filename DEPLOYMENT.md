# NexusNote Deployment Guide

NexusNote is deployed as a container image on a managed deployment platform.

This repository no longer carries:
- Helm charts
- ArgoCD / Flux manifests
- Cluster bootstrap scripts
- In-repo Kubernetes resource definitions

## Deployment model

```text
Git push -> CI build -> image registry -> deployment platform rollout -> schema sync
```

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
2. CI builds and publishes a new image
3. Deployment platform updates to the new image tag
4. Run `bun run db:push`
5. Verify `/api/health`, login, interview, and learn flow

## Schema sync policy

This repository treats the current Drizzle schema as the deployment source of truth.

Run schema sync as part of the platform release process:

```bash
bun run db:push
```

The sync command is non-interactive, applies the current schema directly, and fails fast if the
runtime schema is still incomplete after sync.

## Local development

`docker-compose.yml` is only for local development dependencies.
It is not a production deployment source of truth.
