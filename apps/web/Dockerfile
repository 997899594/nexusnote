# syntax=docker/dockerfile:1

# ============================================
# Stage 1: Prune - 提取构建所需文件
# ============================================
FROM node:22-alpine AS pruner
WORKDIR /app

# 安装 turbo
RUN npm install -g turbo@^2.0.0

# 复制项目文件
COPY . .

# 提取 @nexusnote/web 和 db 构建所需的最小文件集
RUN turbo prune --scope=@nexusnote/web --scope=@nexusnote/db --scope=@nexusnote/config --scope=@nexusnote/types --docker

# ============================================
# Stage 2: Install - 安装依赖
# ============================================
FROM node:22-alpine AS installer
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

# 复制 prune 生成的 package.json 集合
COPY --from=pruner /app/out/json ./
COPY --from=pruner /app/out/pnpm-lock.yaml ./

# 安装依赖
RUN pnpm install --frozen-lockfile --prod=false

# ============================================
# Stage 3: Build - 构建项目
# ============================================
FROM installer AS builder

# 复制 prune 生成的源码集合（只包含相关 package）
COPY --from=pruner /app/out/full ./

# 设置环境变量
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV SKIP_ENV_VALIDATION=true

# 构建所有包（按依赖顺序）
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
  --target=node22 \
  --outfile=hocuspocus.js

RUN pnpm --filter @nexusnote/web exec esbuild src/queue/worker.ts \
  --bundle \
  --platform=node \
  --minify \
  --target=node22 \
  --outfile=worker.js

# ============================================
# Stage 4: Runner - 运行时镜像
# ============================================
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 创建非 root 用户 + 安装 dumb-init
RUN apk add --no-cache dumb-init \
    && addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs \
    && mkdir -p /app/logs && chown -R nextjs:nodejs /app/logs

# 复制构建产物
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./

# 复制 Hocuspocus 和 Worker
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/hocuspocus.js ./apps/web/
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/worker.js ./apps/web/

# 复制静态资源
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public/
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static/

# 复制 package.json
COPY --chown=nextjs:nodejs package.json .
COPY --chown=nextjs:nodejs apps/web/package.json ./apps/web/

USER nextjs

EXPOSE 3000 1234

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "apps/web/server.js"]

# ============================================
# Stage 5: Migration - 数据库迁移专用镜像
# ============================================
# builder 阶段已有完整 node_modules（drizzle-orm, @nexusnote/config, zod 等）
# 直接复用，不需要额外安装任何依赖
FROM node:22-alpine AS migration
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# 只复制迁移所需文件：pnpm 依赖树 + db/config 包
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules/
COPY --from=builder --chown=nextjs:nodejs /app/packages/db ./packages/db/
COPY --from=builder --chown=nextjs:nodejs /app/packages/config ./packages/config/
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./

USER nextjs

ENTRYPOINT ["npx", "drizzle-kit"]
CMD ["push", "--config", "packages/db/drizzle.config.ts"]
