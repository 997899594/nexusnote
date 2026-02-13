# NexusNote 部署指南

## 架构总览

NexusNote 采用 GitOps 架构，运行在腾讯云单节点 K3s 集群上。

```
┌──────────────┐     push      ┌──────────────┐     build     ┌──────────────┐
│  Developer   │ ──────────── │   GitHub      │ ────────────│   GHCR       │
│  git push    │              │   Actions CI  │              │   latest     │
└──────────────┘              └──────────────┘              └──────┬───────┘
                                                                   │ digest 变化
                                                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           K3s Cluster (腾讯云)                              │
│                                                                             │
│  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────────┐           │
│  │  ArgoCD         │  │  Image Updater   │  │  Infisical      │           │
│  │  (GitOps)       │  │  (检测 digest)    │  │  Operator       │           │
│  └────────┬────────┘  └────────┬─────────┘  └────────┬────────┘           │
│           │                    │                      │                     │
│           ▼                    ▼                      ▼                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Sync Wave -2: InfisicalSecret (从 Infisical Cloud 同步密钥)        │   │
│  │  Sync Wave -1: Migration Job (drizzle-kit push)                     │   │
│  │  Sync Wave  0: Deployments + StatefulSets + Services + Gateway      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐                     │
│  │ nexusnote-  │  │ nexusnote-   │  │ nexusnote-   │                     │
│  │ web (:3000) │  │ collab(:1234)│  │ worker       │                     │
│  └─────────────┘  └──────────────┘  └──────────────┘                     │
│                                                                             │
│  ┌──────────────────────┐  ┌──────────────────────┐                       │
│  │  PostgreSQL 16       │  │  Redis 7             │                       │
│  │  + pgvector 0.8.0    │  │  + password auth     │                       │
│  │  (10Gi SSD)          │  │  (1Gi SSD)           │                       │
│  └──────────────────────┘  └──────────────────────┘                       │
│                                                                             │
│  ┌──────────────────────┐                                                  │
│  │  Cilium Gateway API  │──── https://juanie.art                          │
│  │  + Let's Encrypt TLS │                                                  │
│  └──────────────────────┘                                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

## CI/CD 流水线

```
PR → main:     quality-gate (lint + typecheck)
Push → main:   quality-gate → build & push (ghcr.io, tag: latest) → ArgoCD Image Updater → Sync
```

| 阶段 | 触发条件 | 内容 |
|------|---------|------|
| quality-gate | PR 或 push 到 main | pnpm install → lint → typecheck |
| build | 仅 push 到 main | Docker build & push（tag: latest） |
| deploy | Image Updater 检测 digest 变化 | ArgoCD 自动同步到集群 |

## 本地开发

### 前置要求

- Node.js >= 20
- pnpm >= 8
- Docker（用于数据库服务）

### 快速启动

```bash
# 1. 克隆仓库
git clone https://github.com/997899594/nexusnote.git
cd nexusnote

# 2. 安装依赖
pnpm install

# 3. 启动数据库
docker compose up -d

# 4. 配置环境变量
cp .env.example .env
# 编辑 .env，填写 AI API Key 等配置

# 5. 数据库迁移
pnpm db:push

# 6. 启动开发服务
pnpm dev
```

### 本地服务

| 服务 | 地址 | 说明 |
|------|------|------|
| Web App | http://localhost:3000 | Next.js 前端 + API |
| Collaboration | ws://localhost:1234 | Hocuspocus WebSocket |
| PostgreSQL | localhost:5433 | 数据库 |
| Redis | localhost:6380 | 队列 & 缓存 |

## 生产环境部署

### 组件版本

| 组件 | 版本 | 用途 |
|------|------|------|
| K3s | latest | Kubernetes 发行版 |
| ArgoCD | stable | GitOps 控制器 |
| Infisical Operator | 0.10.23 | Secret 自动同步 |
| Cert-Manager | v1.15.0 | TLS 证书管理 |
| Cilium | 内置于 K3s | eBPF 网络 + Gateway API |
| PostgreSQL | 16 (pgvector 0.8.0) | 关系数据库 + 向量检索 |
| Redis | 7-alpine | 队列 + 缓存 |

### 一键初始化

> 仅首次部署执行，之后只需 `git push`

```bash
cd deploy
cp deploy.env.example deploy.env
vim deploy.env    # 填写服务器 IP、GitHub Token、Infisical 凭证
./init.sh --config deploy.env
```

详细步骤见 [deploy/README.md](./deploy/README.md)

### Infisical Secrets 配置

在 Infisical 项目的 `prod` 环境中添加以下密钥：

```
# 数据库（必需）
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@nexusnote-db:5432/nexusnote
POSTGRES_PASSWORD=YOUR_PASSWORD

# Redis（必需）
REDIS_URL=redis://:YOUR_REDIS_PASSWORD@nexusnote-redis:6379
REDIS_PASSWORD=YOUR_REDIS_PASSWORD

# 认证（必需，至少 32 字符）
AUTH_SECRET=your-auth-secret-min-32-characters
JWT_SECRET=your-jwt-secret-min-32-characters

# AI（至少配一个）
AI_302_API_KEY=sk-xxx

# OAuth（可选）
AUTH_GITHUB_ID=your-github-oauth-id
AUTH_GITHUB_SECRET=your-github-oauth-secret
```

### 安全加固

| 项目 | 配置 |
|------|------|
| Pod 安全 | runAsNonRoot, uid/gid 1001, drop ALL capabilities |
| 进程管理 | dumb-init 正确处理信号转发 |
| 滚动更新 | maxUnavailable: 0, maxSurge: 1（零停机） |
| Redis 认证 | `--requirepass` 启用密码 |
| TLS | Let's Encrypt 自动签发，ECDSA P-256 |
| 镜像 | 版本锁定（pgvector:0.8.0-pg16） |

### 数据库备份

内置 CronJob 每日 2:00 UTC 自动备份：

```bash
# 手动触发一次备份
kubectl create job --from=cronjob/postgres-backup manual-backup -n nexusnote

# 查看备份日志
kubectl logs job/manual-backup -n nexusnote

# 备份存储在 postgres-backup-pvc (5Gi)，自动保留 7 天
```

### 日常运维

| 操作 | 方式 |
|------|------|
| 部署代码 | `git push`（ArgoCD 自动同步） |
| 修改配置 | 改 `values-prod.yaml` → `git push` |
| 修改密钥 | Infisical Dashboard（60 秒自动同步） |
| 查看状态 | `kubectl get pods -n nexusnote` |
| 查看日志 | `kubectl logs -n nexusnote -l app=nexusnote-web` |
| 数据库迁移 | 自动（ArgoCD PreSync Job） |
| 访问 ArgoCD | `kubectl port-forward svc/argocd-server -n argocd 8080:443` |

## 故障排查

### Secret 未同步

```bash
kubectl describe infisicalsecret nexusnote-secrets -n nexusnote
kubectl logs -n infisical-operator-system -l app.kubernetes.io/name=secrets-operator
```

### Pod 启动失败

```bash
kubectl get pods -n nexusnote
kubectl describe pod -n nexusnote -l app=nexusnote-web
kubectl logs -n nexusnote -l app=nexusnote-web
```

### 数据库迁移失败

```bash
kubectl logs job/nexusnote-db-migrate-1 -n nexusnote
```

### ArgoCD 同步异常

```bash
kubectl get applications -n argocd
kubectl describe application nexusnote-prod -n argocd
```

## 目录结构

```
deploy/
├── init.sh                    # 本地一键初始化入口
├── bootstrap.sh               # 服务器端引导脚本
├── deploy.env.example         # 配置文件模板
├── README.md                  # 部署操作手册
├── config-plan.md             # Infisical 配置指南
├── argocd/
│   ├── root-app.yaml          # GitOps 入口（App of Apps）
│   ├── applications/
│   │   ├── prod.yaml          # 生产环境 Application
│   │   └── infra.yaml         # 基础设施 Application
│   └── projects/
│       └── nexusnote.yaml     # ArgoCD Project 定义
├── charts/nexusnote/          # Helm Chart
│   ├── Chart.yaml             # Chart 元数据 (v2.0.0)
│   ├── values.yaml            # 默认配置
│   ├── values-prod.yaml       # 生产环境覆盖
│   └── templates/             # 12 个 K8s 资源模板
│       ├── _helpers.tpl
│       ├── backup-cronjob.yaml
│       ├── certificate.yaml
│       ├── configmap.yaml
│       ├── deployment-web.yaml
│       ├── deployment-collab.yaml
│       ├── deployment-worker.yaml
│       ├── infisical-secret.yaml
│       ├── infrastructure.yaml
│       ├── migration-job.yaml
│       ├── service.yaml
│       └── stateful.yaml
└── infra/
    ├── cert-manager/
    │   └── cluster-issuer.yaml
    ├── infisical/
    │   └── README.md
    └── metallb/
        └── ip-pool.yaml
```
