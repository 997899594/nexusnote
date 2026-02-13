# NexusNote GitOps 部署

## 架构

```
Git Push → GitHub Actions (build) → GHCR (latest) → ArgoCD Image Updater → K3s Sync
                                                                              │
                                                              Sync Wave -2: InfisicalSecret
                                                              Sync Wave -1: Migration Job
                                                              Sync Wave  0: 全部应用资源
```

## 一键初始化

> 仅首次部署执行，之后只需 `git push`

### 前置条件

1. **Infisical Cloud** — 注册 https://app.infisical.com，创建项目 `nexusnote`，在 `prod` 环境添加 Secrets，创建 Machine Identity
2. **GitHub Token** — https://github.com/settings/tokens，勾选 `repo` + `read:packages` 权限
3. **SSH 密钥** — `ssh-copy-id root@服务器IP`

### 部署方式

```bash
# 方式一：配置文件（推荐）
cp deploy.env.example deploy.env
vim deploy.env
./init.sh --config deploy.env

# 方式二：交互式
./init.sh
```

## Secrets 清单

在 Infisical 项目的 `prod` 环境中添加：

| 密钥 | 必需 | 说明 |
|------|------|------|
| `DATABASE_URL` | 是 | `postgresql://postgres:PASSWORD@nexusnote-db:5432/nexusnote` |
| `POSTGRES_PASSWORD` | 是 | PostgreSQL 密码 |
| `REDIS_URL` | 是 | `redis://:PASSWORD@nexusnote-redis:6379` |
| `REDIS_PASSWORD` | 是 | Redis 密码 |
| `AUTH_SECRET` | 是 | NextAuth 加密密钥（>=32 字符） |
| `JWT_SECRET` | 是 | JWT 签名密钥（>=32 字符） |
| `AI_302_API_KEY` | 推荐 | 302.ai API Key |
| `DEEPSEEK_API_KEY` | 可选 | DeepSeek API Key |
| `OPENAI_API_KEY` | 可选 | OpenAI API Key |
| `AUTH_GITHUB_ID` | 可选 | GitHub OAuth App ID |
| `AUTH_GITHUB_SECRET` | 可选 | GitHub OAuth App Secret |
| `LANGFUSE_PUBLIC_KEY` | 可选 | Langfuse 可观测性 |
| `LANGFUSE_SECRET_KEY` | 可选 | Langfuse 可观测性 |

## 日常操作

### 部署代码

```bash
git push    # ArgoCD 自动检测镜像更新并同步
```

### 修改配置

```bash
vim deploy/charts/nexusnote/values-prod.yaml
git add . && git commit -m "chore: update config" && git push
```

### 修改密钥

打开 https://app.infisical.com → 修改 Secret → 60 秒内自动同步到集群

### 查看状态

```bash
kubectl get pods -n nexusnote
kubectl get applications -n argocd
kubectl get infisicalsecret -n nexusnote
```

### 访问 ArgoCD

```bash
kubectl port-forward svc/argocd-server -n argocd 8080:443
# 打开 https://localhost:8080

# 获取密码
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d
```

### 数据库备份

```bash
# 内置 CronJob 每日 2:00 UTC 自动备份，保留 7 天
# 手动触发
kubectl create job --from=cronjob/postgres-backup manual-backup -n nexusnote
kubectl logs job/manual-backup -n nexusnote
```

## 目录结构

```
deploy/
├── init.sh                    # 本地一键初始化
├── bootstrap.sh               # 服务器端引导脚本
├── deploy.env.example         # 配置模板
├── config-plan.md             # Infisical 配置详细指南
├── argocd/
│   ├── root-app.yaml          # App of Apps 入口
│   ├── applications/
│   │   ├── prod.yaml          # 生产环境 ArgoCD Application
│   │   └── infra.yaml         # 基础设施 ArgoCD Application
│   └── projects/
│       └── nexusnote.yaml     # ArgoCD Project
├── charts/nexusnote/          # Helm Chart (v2.0.0)
│   ├── Chart.yaml
│   ├── values.yaml            # 默认配置
│   ├── values-prod.yaml       # 生产覆盖（仅 URL 和 Infisical）
│   └── templates/             # 12 个 K8s 资源模板
└── infra/                     # 集群基础设施
    ├── cert-manager/          # Let's Encrypt ClusterIssuer
    ├── infisical/             # Operator 说明
    └── metallb/               # LB-IPAM IP 池
```

## 版本锁定

| 组件 | 版本 |
|------|------|
| ArgoCD | stable |
| Infisical Operator | 0.10.23 |
| Cert-Manager | v1.15.0 |
| PostgreSQL | pgvector:0.8.0-pg16 |
| Redis | 7-alpine |

## 故障排查

### Secret 未同步

```bash
kubectl describe infisicalsecret nexusnote-secrets -n nexusnote
kubectl logs -n infisical-operator-system -l app.kubernetes.io/name=secrets-operator
```

### ArgoCD 无法访问 Git

```bash
kubectl get secret github-repo -n argocd
kubectl describe application root-app -n argocd
```

### Pod 启动失败

```bash
kubectl describe pod -n nexusnote -l app=nexusnote-web
kubectl logs -n nexusnote -l app=nexusnote-web --previous
```

### 数据库迁移失败

```bash
kubectl logs job/nexusnote-db-migrate-1 -n nexusnote
# 迁移 Job 最多重试 3 次（backoffLimit: 3）
```
