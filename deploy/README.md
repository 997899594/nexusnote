# NexusNote 部署

当前仓库只保留 **镜像构建 + 平台部署** 这一路线。

不再维护：
- Helm Chart
- ArgoCD / Flux
- Kubernetes manifests
- 集群初始化脚本

## 推荐部署方式

```text
Git Push -> CI 构建镜像 -> 推送镜像仓库 -> 部署平台拉取新镜像 -> 执行 Schema Sync
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
4. 执行 Schema Sync
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

发布新镜像后，执行：

```bash
bun run db:push
```

这条命令会以当前 Drizzle schema 为准直接同步数据库，并在结束后校验运行时必需的表、列和索引。

## 健康检查

建议平台健康检查指向：

```text
/api/health
```

## 本地说明

`docker-compose.yml` 只用于本地开发依赖，不再代表生产部署架构。
