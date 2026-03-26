# NexusNote Deployment Guide

NexusNote is deployed as a container image on a managed deployment platform.

This repository no longer carries:
- Helm charts
- ArgoCD / Flux manifests
- Cluster bootstrap scripts
- In-repo Kubernetes resource definitions

## Deployment model

```text
Git push -> CI build -> image registry -> deployment platform rollout -> database migration
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
- `OPENAI_API_KEY`
- `DEEPSEEK_API_KEY`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `LANGFUSE_PUBLIC_KEY`
- `LANGFUSE_SECRET_KEY`

## Release flow

1. Push code
2. CI builds and publishes a new image
3. Deployment platform updates to the new image tag
4. Run `bun run db:migrate`
5. Verify `/api/health`, login, interview, and learn flow

## Migration policy

Database schema changes are not applied automatically by this repository.

Run migrations as part of the platform release process:

```bash
bun run db:migrate
```

If your platform supports release commands or post-deploy hooks, use that instead of manual SSH.

## Local development

`docker-compose.yml` is only for local development dependencies.
It is not a production deployment source of truth.
