FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# ---- 安装依赖 ----
FROM base AS deps
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/collab/package.json apps/collab/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/db/package.json packages/db/package.json
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @nexusnote/collab...

# ---- 构建 ----
FROM deps AS build
COPY packages/config packages/config
COPY packages/db packages/db
COPY apps/collab apps/collab
RUN pnpm --filter @nexusnote/config build && \
    pnpm --filter @nexusnote/db build && \
    pnpm --filter @nexusnote/collab build

# ---- 运行 ----
FROM base AS runtime
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/collab/dist ./dist
COPY --from=build /app/apps/collab/package.json ./package.json
COPY --from=build /app/packages/config/dist ./node_modules/@nexusnote/config/dist
COPY --from=build /app/packages/db/dist ./node_modules/@nexusnote/db/dist

EXPOSE 1234
CMD ["node", "dist/index.js"]
