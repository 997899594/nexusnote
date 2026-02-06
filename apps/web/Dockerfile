# syntax=docker/dockerfile:1

# ============================================
# Stage 1: Dependencies
# ============================================
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

# Copy workspace files
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/ui/package.json ./packages/ui/
COPY packages/db/package.json ./packages/db/
COPY packages/config/package.json ./packages/config/
COPY packages/types/package.json ./packages/types/

# Install dependencies
RUN pnpm install --frozen-lockfile --prod=false

# ============================================
# Stage 2: Builder
# ============================================
FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/packages/ui/node_modules ./packages/ui/node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /app/packages/config/node_modules ./packages/config/node_modules
COPY --from=deps /app/packages/types/node_modules ./packages/types/node_modules

# Copy source code
COPY . .

# Set environment for build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV SKIP_ENV_VALIDATION=true

# Build all packages
RUN pnpm --filter @nexusnote/types build
RUN pnpm --filter @nexusnote/config build
RUN pnpm --filter @nexusnote/db build
RUN pnpm --filter @nexusnote/ui build
RUN pnpm --filter @nexusnote/web build

# Compile auxiliary servers (Hocuspocus and Worker)
# Output files will be generated at apps/web/hocuspocus.js and apps/web/worker.js relative to WORKDIR /app
RUN pnpm --filter @nexusnote/web exec esbuild src/server/hocuspocus.ts --bundle --platform=node --outfile=hocuspocus.js \
    --external:ioredis --external:bullmq --external:@hocuspocus/* --external:yjs
RUN pnpm --filter @nexusnote/web exec esbuild src/queue/worker.ts --bundle --platform=node --outfile=worker.js \
    --external:ioredis --external:bullmq --external:zod --external:drizzle-orm

# ============================================
# Stage 3: Runner
# ============================================
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Install PM2 globally for process management
RUN npm install -g pm2

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Create logs directory
RUN mkdir -p /app/logs && chown -R nextjs:nodejs /app/logs

# Copy built application and all dependencies
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/hocuspocus.js ./apps/web/
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/worker.js ./apps/web/
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/ecosystem.config.js ./apps/web/

# Conditional copy for static assets and public folder
RUN --mount=from=builder,source=/app/apps/web,target=/tmp/web \
    ( [ -d /tmp/web/public ] && cp -r /tmp/web/public ./apps/web/public || true ) && \
    ( [ -d /tmp/web/.next/static ] && mkdir -p ./apps/web/.next && cp -r /tmp/web/.next/static ./apps/web/.next/static || true ) && \
    chown -R nextjs:nodejs /app/apps/web

# Copy package.json for metadata
COPY --chown=nextjs:nodejs package.json .
COPY --chown=nextjs:nodejs apps/web/package.json ./apps/web/

USER nextjs

EXPOSE 3002 1234

ENV PORT=3002
ENV HOSTNAME="0.0.0.0"

# Start all services with PM2
CMD ["pm2-runtime", "start", "apps/web/ecosystem.config.js"]

