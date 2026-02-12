# NexusNote 配置系统方案 - Infisical Cloud

## 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                     Infisical Cloud                          │
│                   （管理所有 Secrets）                        │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Project: nexusnote                                   │    │
│  │ ├── DATABASE_URL                                     │    │
│  │ ├── REDIS_URL                                        │    │
│  │ ├── JWT_SECRET                                       │    │
│  │ ├── AI_302_API_KEY                                   │    │
│  │ └── ...                                              │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ Infisical Operator 自动同步
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                      K8s Cluster                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ InfisicalSecret CRD                                  │    │
│  │   └── 创建 K8s Secret: nexusnote-secrets            │    │
│  └─────────────────────────────────────────────────────┘    │
│                          │                                   │
│                          ▼                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Deployment (web/collab/worker)                       │    │
│  │   └── envFrom: secretRef: nexusnote-secrets         │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## 变量分类

### 🔴 敏感信息（Infisical 管理）

| 变量 | 说明 | 必需 |
|------|------|------|
| `DATABASE_URL` | PostgreSQL 连接串 | ✅ |
| `REDIS_URL` | Redis 连接串 | ✅ |
| `POSTGRES_PASSWORD` | 数据库密码 | ✅ |
| `JWT_SECRET` | JWT 签名密钥 | ✅ |
| `AUTH_SECRET` | NextAuth 密钥 | ✅ |
| `AUTH_GITHUB_ID` | GitHub OAuth ID | ❌ |
| `AUTH_GITHUB_SECRET` | GitHub OAuth Secret | ❌ |
| `AI_302_API_KEY` | 302.ai API Key | ❌ |
| `DEEPSEEK_API_KEY` | DeepSeek API Key | ❌ |
| `SILICONFLOW_API_KEY` | SiliconFlow API Key | ❌ |
| `OPENAI_API_KEY` | OpenAI API Key | ❌ |
| `LANGFUSE_PUBLIC_KEY` | Langfuse 公钥 | ❌ |
| `LANGFUSE_SECRET_KEY` | Langfuse 私钥 | ❌ |

### 🟢 非敏感配置（values.yaml）

```yaml
env:
  NODE_ENV: "production"
  PORT: "3000"
  HOCUSPOCUS_PORT: "1234"
  NEXT_PUBLIC_APP_URL: "https://juanie.art"
  NEXTAUTH_URL: "https://juanie.art"
  AUTH_TRUST_HOST: "true"

  # AI 模型配置
  AI_MODEL: "gemini-3-flash-preview"
  AI_MODEL_PRO: "gemini-3-pro-preview"
  AI_ENABLE_WEB_SEARCH: "true"

  # Embedding
  EMBEDDING_MODEL: "Qwen/Qwen3-Embedding-8B"
  EMBEDDING_DIMENSIONS: "4000"
```

## 设置步骤

### 步骤 1：注册 Infisical Cloud

1. 访问 https://app.infisical.com
2. 注册免费账号
3. 创建组织

### 步骤 2：创建项目和 Secrets

1. 创建 Project（如 `nexusnote`）
2. 选择 Environment（如 `prod`）
3. 添加以下 Secrets：

```
# 数据库
DATABASE_URL=postgresql://postgres:PASSWORD@nexusnote-db:5432/nexusnote
POSTGRES_PASSWORD=your-password

# Redis
REDIS_URL=redis://nexusnote-redis:6379

# 认证
JWT_SECRET=your-jwt-secret-min-32-chars
AUTH_SECRET=your-auth-secret-min-32-chars

# OAuth
AUTH_GITHUB_ID=your-github-oauth-id
AUTH_GITHUB_SECRET=your-github-oauth-secret

# AI Keys
AI_302_API_KEY=sk-xxx
DEEPSEEK_API_KEY=sk-xxx
SILICONFLOW_API_KEY=sk-xxx
OPENAI_API_KEY=sk-xxx

# 可观测性
LANGFUSE_PUBLIC_KEY=pk-xxx
LANGFUSE_SECRET_KEY=sk-xxx
```

### 步骤 3：创建 Machine Identity

1. 点击右上角用户头像/组织名称
2. 选择 **Organization Settings**
3. 左侧导航栏：**Access Control** → **Machine Identities**
4. 或直接访问：`https://app.infisical.com/settings/access/machine-identities`
5. 点击 **Create Identity**
6. 选择 **Universal Auth**
7. 保存：
   - Client ID
   - Client Secret

### 步骤 4：获取 Project Slug

1. 进入 Project Settings
2. 复制 Project Slug

### 步骤 5：授予 Project 访问权限

1. 进入 Project Settings → Project Access
2. 添加 Machine Identity
3. 授予 Read 权限

### 步骤 6：配置集群凭证

```bash
# 在服务器执行
kubectl create secret generic infisical-credentials \
  --namespace=nexusnote \
  --from-literal=clientId=YOUR_CLIENT_ID \
  --from-literal=clientSecret=YOUR_CLIENT_SECRET
```

### 步骤 7：更新 values-prod.yaml

```yaml
infisical:
  enabled: true
  projectSlug: "nexusnote"  # 你的 Project Slug
  envSlug: "prod"
```

### 步骤 8：部署

```bash
git add . && git commit -m "feat: configure infisical" && git push
```

## 日常操作

### 更新非敏感配置

```bash
vim deploy/charts/nexusnote/values-prod.yaml
git push
```

### 更新敏感信息

1. 打开 Infisical Dashboard
2. 修改 Secret
3. 保存（60秒内自动同步到集群）

### 查看同步状态

```bash
# 查看 InfisicalSecret 状态
kubectl get infisicalsecret -n nexusnote

# 查看详情
kubectl describe infisicalsecret nexusnote-secrets -n nexusnote

# 查看生成的 Secret
kubectl get secret nexusnote-secrets -n nexusnote
```

## 与旧方案对比

| | GitHub Secrets | Infisical Cloud |
|---|---|---|
| Secrets 存储 | GitHub | Infisical Cloud |
| CI 接触敏感信息 | ✅ 是 | ❌ 否 |
| 修改方式 | GitHub Settings | Web UI |
| 自动同步 | ❌ | ✅ 60秒 |
| 版本历史 | ❌ | ✅ |
| 审计日志 | ❌ | ✅ |
| 多环境 | 手动 | 原生支持 |
| 免费额度 | 无限 | 3 项目 |

## 故障排查

### Secret 未同步

```bash
# 检查 Operator 日志
kubectl logs -n infisical-operator-system -l app=secrets-operator

# 检查 InfisicalSecret 状态
kubectl describe infisicalsecret nexusnote-secrets -n nexusnote

# 常见问题：
# 1. 凭证错误 → 重新创建 infisical-credentials
# 2. Project Slug 错误 → 检查 values.yaml
# 3. 权限不足 → 检查 Machine Identity 的 Project Access
```

### Pod 无法读取 Secret

```bash
# 检查 Secret 是否存在
kubectl get secret nexusnote-secrets -n nexusnote

# 检查 Secret 内容
kubectl get secret nexusnote-secrets -n nexusnote -o jsonpath='{.data}' | jq
```

## 参考

- [Infisical 官方文档](https://infisical.com/docs)
- [Kubernetes Operator 文档](https://infisical.com/docs/integrations/platforms/kubernetes/overview)
- [Infisical Cloud](https://app.infisical.com)
