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

# 复制 db 包供迁移使用（只复制必要文件，避免 node_modules）
RUN mkdir -p /app/packages/db/src /app/packages/db/drizzle
COPY --from=builder --chown=nextjs:nodejs /app/packages/db/src/ ./packages/db/src/
COPY --from=builder --chown=nextjs:nodejs /app/packages/db/drizzle/ ./packages/db/drizzle/
COPY --from=builder --chown=nextjs:nodejs /app/packages/db/drizzle.config.ts ./packages/db/
COPY --from=builder --chown=nextjs:nodejs /app/packages/db/package.json ./packages/db/

# 复制 config 包（schema.ts 通过 @nexusnote/config 引用）
COPY --from=builder --chown=nextjs:nodejs /app/packages/config/dist ./packages/config/dist/
COPY --from=builder --chown=nextjs:nodejs /app/packages/config/package.json ./packages/config/

# 安装迁移依赖：drizzle-kit push 需要 drizzle-orm + @nexusnote/config (zod)
RUN npm install -g drizzle-kit@0.30.0 \
    && mkdir -p /app/node_modules/@nexusnote \
    && ln -s /app/packages/config /app/node_modules/@nexusnote/config \
    && cd /tmp && mkdir deps && cd deps && npm init -y > /dev/null 2>&1 \
    && npm install --no-save drizzle-orm@0.44.0 zod@4 > /dev/null 2>&1 \
    && cp -r node_modules/drizzle-orm /app/node_modules/ \
    && cp -r node_modules/zod /app/node_modules/ \
    && cd / && rm -rf /tmp/deps

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
