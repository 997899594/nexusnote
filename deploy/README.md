# NexusNote 部署

当前仓库只保留 **镜像构建 + 平台部署** 这一路线。

不再维护：
- Helm Chart
- ArgoCD / Flux
- Kubernetes manifests
- 集群初始化脚本

## 推荐部署方式

```text
代码合并到主分支 -> CI 构建镜像 -> 推送镜像仓库 -> Juanie Drizzle schema 闸门 -> 部署平台拉取新镜像
```

适用前提：
- 你的部署平台已经支持镜像发布
- 平台能注入环境变量
- 平台能配置健康检查和域名

## 运行要求

应用运行至少需要：
- PostgreSQL（带 pgvector）
- Redis
- 一个能发布容器镜像的仓库
- 一个能运行容器并注入环境变量的部署平台

## 最小发布流程

1. 构建并推送镜像
2. 在部署平台更新镜像 tag
3. 注入/校验环境变量
4. 让 Juanie 按 `juanie.yaml -> schema.source: drizzle -> drizzle.config.mjs` 完成 schema gate
5. 检查健康接口和登录链路

## 必要环境变量

参见 `deploy.env.example`。

至少需要：
- `DATABASE_URL`
- `REDIS_URL`
- `AUTH_SECRET`
- `NEXT_PUBLIC_APP_URL`
- `AUTH_URL`
- `AI_302_API_KEY`

## Schema Sync

发布新镜像前，Juanie 会根据仓库中的 `drizzle.config.mjs` 与 `drizzle/` 目录应用 schema 变更。
对于 PostgreSQL，`juanie.yaml` 已声明 `capabilities: [vector]`，平台会先兑现 pgvector 运行时能力。

## 镜像构建说明

- `Dockerfile.web` 是唯一的镜像构建入口
- CI 不再预生成 `.docker-runtime`
- Next.js 构建发生在 Docker multi-stage builder 内部
- 运行镜像不再承载部署期 schema 命令职责

## 健康检查

建议平台健康检查指向：

```text
/api/health
```

## 本地说明

`docker-compose.yml` 只用于本地开发依赖，不再代表生产部署架构。
