# syntax=docker/dockerfile:1

# ============================================
# Stage 1: Dependencies
# ============================================
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

# Copy workspace files
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/server/package.json ./apps/server/
COPY packages/db/package.json ./packages/db/

# Install dependencies
RUN pnpm install --frozen-lockfile

# ============================================
# Stage 2: Builder
# ============================================
FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/server/node_modules ./apps/server/node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules

# Copy source
COPY . .

# Build
ENV NODE_ENV=production
RUN pnpm --filter @nexusnote/server build

# ============================================
# Stage 3: Runner
# ============================================
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nestjs
RUN adduser --system --uid 1001 nestjs

# Copy built application
COPY --from=builder --chown=nestjs:nestjs /app/apps/server/dist ./dist
COPY --from=builder --chown=nestjs:nestjs /app/apps/server/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nestjs /app/apps/server/package.json ./

USER nestjs

# NestJS API port
EXPOSE 3001
# Hocuspocus WebSocket port
EXPOSE 1234

ENV PORT=3001
ENV HOCUSPOCUS_PORT=1234

CMD ["node", "dist/main.js"]
