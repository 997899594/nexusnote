# NexusNote GitOps 部署 - 2026 最现代化版本

## 架构

```
┌─────────────────────────────────────────────────────────────┐
│                     Infisical Cloud                          │
│                   （管理所有 Secrets）                        │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ 自动同步（60秒）
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                      K8s Cluster                             │
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │ ArgoCD          │  │ Infisical       │                   │
│  │ (GitOps)        │  │ Operator        │                   │
│  └────────┬────────┘  └────────┬────────┘                   │
│           │                    │                             │
│           ▼                    ▼                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              NexusNote Application                   │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## 一键初始化

> ⚠️ 这是**一次性初始化**，之后部署只需 `git push`

### 方式一：配置文件（推荐）

```bash
# 1. 复制配置文件
cd deploy
cp deploy.env.example deploy.env

# 2. 编辑配置
vim deploy.env

# 3. 一键初始化
./init.sh --config deploy.env
```

### 方式二：命令行参数

```bash
./init.sh \
  --env prod \
  --server root@49.232.237.136 \
  GITHUB_TOKEN=ghp_xxx \
  INFISICAL_CLIENT_ID=xxx \
  INFISICAL_CLIENT_SECRET=xxx
```

### 方式三：交互式

```bash
./init.sh
# 按提示输入配置
```

---

## 前置条件

### 1. 设置 Infisical Cloud

1. 访问 https://app.infisical.com 注册账号
2. 创建项目 `nexusnote`
3. 在 `prod` 环境添加 Secrets（见下方列表）
4. 创建 Machine Identity 获取 Client ID/Secret

详细步骤见 [config-plan.md](./config-plan.md)

### 2. 准备 GitHub Token

1. 访问 https://github.com/settings/tokens
2. 创建 Token，勾选 `repo` 权限

### 3. 配置 SSH 密钥

```bash
# 本地生成密钥（如果没有）
ssh-keygen -t ed25519 -C "your@email.com"

# 复制公钥到服务器
ssh-copy-id root@你的服务器IP
```

---

## Secrets 列表

在 Infisical 项目的 `prod` 环境添加：

```
# 数据库
DATABASE_URL=postgresql://postgres:PASSWORD@nexusnote-db:5432/nexusnote
POSTGRES_PASSWORD=YOUR_PASSWORD

# Redis
REDIS_URL=redis://nexusnote-redis:6379

# 认证（至少32字符）
JWT_SECRET=your-jwt-secret-min-32-characters
AUTH_SECRET=your-auth-secret-min-32-characters

# OAuth（可选）
AUTH_GITHUB_ID=your-github-oauth-id
AUTH_GITHUB_SECRET=your-github-oauth-secret

# AI Keys（可选）
AI_302_API_KEY=sk-xxx
```

---

## 版本锁定

| 组件 | 版本 |
|------|------|
| ArgoCD | stable |
| Infisical Operator | 0.10.23 |
| Cert-Manager | v1.15.0 |

---

## 部署后

### 访问应用

```
https://juanie.art
```

### 访问 ArgoCD

```bash
kubectl port-forward svc/argocd-server -n argocd 8080:443
# 打开 https://localhost:8080

# 获取密码
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d
```

### 查看状态

```bash
kubectl get applications -n argocd
kubectl get pods -n nexusnote
kubectl get infisicalsecret -n nexusnote
```

---

## 日常操作

### 部署代码更新

```bash
git push  # ArgoCD 自动同步
```

### 修改非敏感配置

```bash
vim deploy/charts/nexusnote/values-prod.yaml
git add . && git commit -m "chore: update config" && git push
```

### 修改敏感信息

1. 打开 https://app.infisical.com
2. 修改 Secret
3. 保存（60秒内自动同步）

---

## 目录结构

```
deploy/
├── init.sh                # 一键初始化入口
├── deploy.env.example     # 配置文件模板
├── bootstrap.sh           # 服务器端脚本
├── README.md              # 本文档
├── config-plan.md         # Infisical 配置指南
├── argocd/
│   ├── root-app.yaml      # GitOps 入口
│   └── applications/      # 各环境配置
├── charts/nexusnote/      # Helm Chart
│   ├── values.yaml        # 默认配置
│   ├── values-prod.yaml   # 生产环境
│   └── templates/
└── infra/                 # 基础设施
    ├── cert-manager/
    ├── metallb/
    └── infisical/
```

---

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
kubectl logs -n nexusnote -l app=nexusnote-web
kubectl describe pod -n nexusnote -l app=nexusnote-web
```

---

## 对比

| | 旧方案 | 新方案 |
|---|---|---|
| Secrets 管理 | GitHub Secrets | Infisical Cloud |
| 部署方式 | SSH 脚本 | GitOps (ArgoCD) |
| 一键初始化 | ❌ | ✅ `./init.sh` |
| 配置管理 | 环境变量 | 配置文件 |
| 版本锁定 | ❌ | ✅ |
| 幂等执行 | ❌ | ✅ |
| 健康检查 | ❌ | ✅ |
