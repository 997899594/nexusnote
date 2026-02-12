# Infisical Secrets Operator 配置

## 前置条件

1. 注册 Infisical Cloud 免费账号：https://app.infisical.com
2. 创建组织和项目
3. 创建 Machine Identity（用于 Kubernetes 认证）

## 认证方式

Infisical 支持两种认证方式：

### 方式 1：Universal Auth（推荐，简单）
使用 Client ID + Client Secret 认证。

### 方式 2：Kubernetes Auth（更安全）
使用 Kubernetes Service Account 认证。

---

## 设置步骤

### 1. 在 Infisical 创建 Machine Identity

1. 登录 Infisical Cloud
2. 进入 Organization Settings → Machine Identities
3. 创建新 Identity，选择 **Universal Auth**
4. 保存 Client ID 和 Client Secret

### 2. 创建项目并添加 Secrets

1. 创建 Project（如 `nexusnote`）
2. 添加以下 Secrets：

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

### 3. 授予 Identity 访问权限

1. 进入 Project Settings → Project Access
2. 添加 Machine Identity
3. 授予 Read/Write 权限

### 4. 获取配置信息

需要以下信息配置 Helm Chart：
- `projectId`：项目设置页面获取
- `clientId`：Machine Identity 页面获取
- `clientSecret`：创建 Identity 时保存的

---

## 参考

- [Infisical Kubernetes Operator 文档](https://infisical.com/docs/integrations/platforms/kubernetes/overview)
- [Infisical Cloud 免费版](https://app.infisical.com)
