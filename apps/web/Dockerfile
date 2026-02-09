# syntax=docker/dockerfile:1

# ============================================
# Build ARGs - 用于控制缓存失效
# ============================================
# 每次架构重大变更时，修改 BUILD_CACHE_BUST 的值（如 v1, v2...）
# ARG 必须在第一个 FROM 之前声明才能影响整个构建的所有层
ARG BUILD_CACHE_BUST=v2

# ============================================
# Stage 1: Dependencies
# ============================================
FROM node:20-alpine AS deps

# BUILD_CACHE_BUST 用于强制失效缓存层
ARG BUILD_CACHE_BUST
RUN echo "Cache bust (deps): ${BUILD_CACHE_BUST}" > /tmp/cache_bust
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

# BUILD_CACHE_BUST ARG 用于在架构变更时强制失效构建缓存
ARG BUILD_CACHE_BUST
RUN echo "Cache bust: ${BUILD_CACHE_BUST}" > /tmp/cache_bust

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

# ============================================
# Build Hocuspocus and Worker
# ============================================
# 2026 最佳实践：完全打包，不依赖运行时 node_modules
# --platform=node: 生成 Node.js 兼容代码
# --bundle: 将所有依赖打包到单个文件
# --minify: 压缩代码
# --tree-shaking: 自动移除未使用的代码
# --target=node20: 针对 Node.js 20 优化
RUN pnpm --filter @nexusnote/web exec esbuild src/server/hocuspocus.ts \
  --bundle \
  --platform=node \
  --minify \
  --target=node20 \
  --outfile=hocuspocus.js

RUN pnpm --filter @nexusnote/web exec esbuild src/queue/worker.ts \
  --bundle \
  --platform=node \
  --minify \
  --target=node20 \
  --outfile=worker.js

# ============================================
# Stage 3: Runner
# ============================================
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Create logs directory
RUN mkdir -p /app/logs && chown -R nextjs:nodejs /app/logs

# Copy built application and all dependencies
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./

# Copy Hocuspocus and Worker (完全打包，无需额外依赖)
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/hocuspocus.js ./apps/web/
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/worker.js ./apps/web/

# Conditional copy for static assets and public folder
RUN --mount=from=builder,source=/app/apps/web,target=/tmp/web \
    ( [ -d /tmp/web/public ] && cp -r /tmp/web/public ./apps/web/public || true ) && \
    ( [ -d /tmp/web/.next/static ] && mkdir -p ./apps/web/.next && cp -r /tmp/web/.next/static ./apps/web/.next/static || true ) && \
    chown -R nextjs:nodejs /app/apps/web

# Copy package.json for metadata
COPY --chown=nextjs:nodejs package.json .
COPY --chown=nextjs:nodejs apps/web/package.json ./apps/web/

USER nextjs

EXPOSE 3000 1234

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Start application
CMD ["node", "server.js"]

