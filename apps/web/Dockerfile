# syntax=docker/dockerfile:1

# ============================================
# Stage 1: Base Layer - 稳定的依赖层
# ============================================
FROM node:22-alpine AS base
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

# 复制依赖配置文件
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/ui/package.json ./packages/ui/
COPY packages/db/package.json ./packages/db/
COPY packages/config/package.json ./packages/config/
COPY packages/types/package.json ./packages/types/

# 安装依赖（依赖不变时使用缓存）
RUN pnpm install --frozen-lockfile --prod=false

# ============================================
# Stage 2: App Layer - 代码变化层
# ============================================
FROM base AS builder

# 复制源代码（依赖层已包含 node_modules）
COPY apps/web/src ./apps/web/src/
COPY apps/web/public ./apps/web/public/
COPY apps/web/next.config.js ./apps/web/
COPY packages/ui/src ./packages/ui/src/
COPY packages/db/src ./packages/db/src/
COPY packages/config/src ./packages/config/src/
COPY packages/types/src ./packages/types/src/

# 设置环境变量
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV SKIP_ENV_VALIDATION=true

# 构建所有包
RUN pnpm --filter @nexusnote/types build
RUN pnpm --filter @nexusnote/config build
RUN pnpm --filter @nexusnote/db build
RUN pnpm --filter @nexusnote/ui build
RUN pnpm --filter @nexusnote/web build

# ============================================
# Build Hocuspocus and Worker
# ============================================
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
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 创建日志目录
RUN mkdir -p /app/logs && chown -R nextjs:nodejs /app/logs

# 复制构建产物
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./

# 复制 Hocuspocus 和 Worker
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/hocuspocus.js ./apps/web/
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/worker.js ./apps/web/

# 复制静态资源（明确列出）
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public/
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static/

# 复制 package.json
COPY --chown=nextjs:nodejs package.json .
COPY --chown=nextjs:nodejs apps/web/package.json ./apps/web/

USER nextjs

EXPOSE 3000 1234

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/web/server.js"]
