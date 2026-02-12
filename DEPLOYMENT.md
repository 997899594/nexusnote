# NexusNote 部署指南

## 架构概述

NexusNote 是一个完整的 Next.js Fullstack 应用，运行在 K3s 集群中：

```
┌─────────────────────────────────────────────────────────────┐
│                     Infisical Cloud                          │
│                   （管理所有 Secrets）                        │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ 自动同步
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                      K3s Cluster                             │
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │ ArgoCD          │  │ Infisical       │                   │
│  │ (GitOps)        │  │ Operator        │                   │
│  └────────┬────────┘  └────────┬────────┘                   │
│           │                    │                             │
│           ▼                    ▼                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  nexusnote-web (Next.js API + HMR)                  │    │
│  │  nexusnote-collab (Hocuspocus WebSocket)            │    │
│  │  nexusnote-worker (BullMQ 后台任务)                  │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## 本地开发

### 前置要求

- Node.js 22+
- PostgreSQL 16+ (with pgvector)
- Redis 7+
- pnpm 9+

### 快速启动

```bash
# 1. 安装依赖
pnpm install

# 2. 迁移数据库
pnpm exec drizzle-kit push

# 3. 启动所有服务
pnpm dev
```

### 环境变量配置

创建 `.env` 文件（参考 `.env.example`）：

```env
# 数据库
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/nexusnote
REDIS_URL=redis://localhost:6379

# 认证
AUTH_SECRET=your-secret-key-min-32-chars
JWT_SECRET=your-jwt-secret-min-32-chars

# AI
AI_302_API_KEY=your-api-key

# 可选：OAuth
AUTH_GITHUB_ID=
AUTH_GITHUB_SECRET=
```

## 生产环境部署 (K3s + GitOps)

### 架构

| 组件 | 说明 |
|------|------|
| ArgoCD | GitOps 控制器，自动同步 Git 配置到集群 |
| Infisical Operator | 从 Infisical Cloud 同步 Secrets |
| Cert-Manager | 自动签发 Let's Encrypt 证书 |
| Cilium | eBPF 网络层 |

### 一键初始化

```bash
# SSH 到服务器，执行：
curl -sSL https://raw.githubusercontent.com/nexusnote/nexusnote/main/deploy/bootstrap.sh | bash
```

### 配置 Infisical

1. 访问 https://app.infisical.com 注册账号
2. 创建项目 `nexusnote` 并添加 Secrets
3. 创建 Machine Identity：
   - 点击右上角头像 → Organization Settings
   - Access Control → Machine Identities
   - 或直接访问：`https://app.infisical.com/settings/access/machine-identities`
4. 配置集群凭证（见 `deploy/README.md`）

详细步骤见 `deploy/config-plan.md`

### 日常操作

| 操作 | 命令 |
|------|------|
| 部署代码 | `git push` |
| 修改配置 | 改 `values-prod.yaml` + `git push` |
| 修改密码 | Infisical Dashboard（自动同步）|

### 访问 ArgoCD

```bash
kubectl port-forward svc/argocd-server -n argocd 8080:443
# 打开 https://localhost:8080

# 获取密码
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d
```

## 目录结构

```
deploy/
├── bootstrap.sh          # 一键初始化
├── README.md             # 部署文档
├── config-plan.md        # 配置系统方案
├── argocd/               # ArgoCD 配置
│   ├── root-app.yaml     # GitOps 入口
│   └── applications/     # 各环境配置
├── charts/nexusnote/     # Helm Chart
│   ├── values.yaml       # 默认配置
│   ├── values-prod.yaml  # 生产环境
│   └── templates/        # K8s 资源模板
└── infra/                # 基础设施
    ├── cert-manager/     # 证书管理
    ├── metallb/          # 负载均衡
    └── infisical/        # Secrets 管理
```

## 故障排查

### 应用无法启动

```bash
# 检查 Pod 状态
kubectl get pods -n nexusnote

# 查看日志
kubectl logs -n nexusnote -l app=nexusnote-web

# 检查 Secrets
kubectl get secret nexusnote-secrets -n nexusnote
```

### Secret 未同步

```bash
# 检查 InfisicalSecret 状态
kubectl get infisicalsecret -n nexusnote
kubectl describe infisicalsecret nexusnote-secrets -n nexusnote

# 检查 Operator 日志
kubectl logs -n infisical-operator-system -l app=secrets-operator
```

## 参考资料

- [ArgoCD 文档](https://argo-cd.readthedocs.io/)
- [Infisical 文档](https://infisical.com/docs)
- [K3s 文档](https://docs.k3s.io/)
