# Render 免费部署指南

**零成本，无需信用卡，5分钟部署**

---

## 优势与限制

### ✅ 优势
- 完全免费
- 无需信用卡
- GitHub 登录即可
- 自动 HTTPS
- 支持 PostgreSQL + pgvector

### ⚠️ 限制
- 15分钟无请求会休眠（冷启动 ~30秒）
- 免费 PostgreSQL 只有 1GB（够用）
- 适合个人/演示项目

---

## 快速部署

### 1. 准备代码仓库

```bash
# 推送代码到 GitHub
git add .
git commit -m "准备部署到 Render"
git push origin main
```

### 2. 连接 Render

1. 访问 https://render.com
2. 点击 **Sign Up** → 选择 **GitHub**
3. 授权 Render 访问你的仓库

### 3. 一键部署

```
Dashboard → New → Blueprint
→ 选择 nexusnote 仓库
→ Render 会自动读取 render.yaml
→ 点击 "Apply"
```

### 4. 配置环境变量

部署后，需要在每个服务中设置环境变量。

---

## 环境变量配置

### nexusnote-server (后端服务)

进入 Render Dashboard → nexusnote-server → Environment，添加以下变量：

#### 必需变量

```bash
# AI Provider
AI_PROVIDER=deepseek

# DeepSeek API Key（Chat 模型）
DEEPSEEK_API_KEY=sk-your-deepseek-key

# 302.ai API Key（Embedding 模型）
AI_302_API_KEY=sk-your-302ai-key

# Redis（从 Upstash 获取）
REDIS_URL=rediss://default:你的密码@fit-mako-7704.upstash.io:6379

# JWT Secret（生成一个随机字符串）
JWT_SECRET=nexusnote-prod-2026-change-this-to-random-string

# CORS（允许前端访问）
CORS_ORIGIN=https://nexusnote-web.onrender.com
```

#### 可选变量（已在 render.yaml 配置）

```bash
# Embedding 配置
EMBEDDING_MODEL=Qwen/Qwen3-Embedding-8B
EMBEDDING_DIMENSIONS=4000

# Reranker 配置
RERANKER_ENABLED=true
RERANKER_MODEL=Qwen/Qwen3-Reranker-8B

# RAG 配置
RAG_CHUNK_SIZE=500
RAG_CHUNK_OVERLAP=50
```

---

### nexusnote-web (前端服务)

进入 Render Dashboard → nexusnote-web → Environment，添加以下变量：

#### 必需变量

```bash
# AI Provider
AI_PROVIDER=deepseek

# DeepSeek API Key（前端直接调用 AI）
DEEPSEEK_API_KEY=sk-your-deepseek-key

# 302.ai API Key（前端 Embedding）
AI_302_API_KEY=sk-your-302ai-key

# WebSocket URL（协作功能）
NEXT_PUBLIC_COLLAB_URL=wss://nexusnote-server.onrender.com
```

#### 自动配置的变量（无需手动添加）

```bash
# API URL（自动从 server 服务获取）
NEXT_PUBLIC_API_URL=https://nexusnote-server.onrender.com
```

---

## 配置步骤详解

### 1. 生成 JWT Secret

在本地终端运行：

```bash
# 方法 1：使用 Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 方法 2：使用 OpenSSL
openssl rand -hex 32

# 输出示例：
# a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
```

### 2. 获取 Upstash Redis URL

1. 登录 [Upstash Console](https://console.upstash.com/)
2. 点击你的 Redis 数据库
3. 复制 **Connection String**（格式：`rediss://default:xxx@xxx.upstash.io:6379`）

### 3. 在 Render 添加环境变量

#### 方法 A：通过 Dashboard（推荐）

1. 进入服务页面
2. 点击 **Environment** 标签
3. 点击 **Add Environment Variable**
4. 逐个添加上述变量
5. 点击 **Save Changes**

#### 方法 B：通过 render.yaml（需要重新部署）

编辑 `render.yaml`，将 `sync: false` 改为具体的值（不推荐，会暴露密钥）

---

### 5. 启用 pgvector

```bash
# Dashboard → nexusnote-db → Connect → Shell
# 执行:
CREATE EXTENSION vector;
```

### 6. 完成！

访问 `https://nexusnote-web.onrender.com`

---

## 验证配置

### 1. 检查 Server 启动日志

部署完成后，查看 Server 日志应该看到：

```
[Config] Server environment validated:
  NODE_ENV: production
  PORT: 10000
  DATABASE_URL: postgresql://***@***
  REDIS_URL: rediss://***@***.upstash.io:6379
  AI_302_API_KEY: ***
  DEEPSEEK_API_KEY: ***
  EMBEDDING_MODEL: Qwen/Qwen3-Embedding-8B
  EMBEDDING_DIMENSIONS: 4000
  RERANKER_ENABLED: true

[RAG] 2026 Architecture - AI SDK 6.x
[RAG] Model: Qwen/Qwen3-Embedding-8B
[RAG] Dimensions: 4000
[RAG Worker] Started

[NestApplication] Nest application successfully started
```

### 2. 测试 API

```bash
# Health Check
curl https://nexusnote-server.onrender.com/health

# 应该返回：
{"status":"ok","timestamp":"2026-01-23T..."}
```

### 3. 测试 Web

访问 https://nexusnote-web.onrender.com，应该能：
- 打开编辑器
- 使用 AI Chat
- 创建文档

---

## 唤醒优化（防止休眠）

免费版会在 15 分钟无请求后休眠，可以用定时 ping 保持唤醒：

### 方法 1: UptimeRobot（推荐）

```
1. 访问 https://uptimerobot.com（免费）
2. 添加监控：https://nexusnote-web.onrender.com
3. 每 5 分钟 ping 一次 → 永不休眠
```

### 方法 2: Cron-job.org

```
1. 访问 https://cron-job.org
2. 创建定时任务
3. URL: https://nexusnote-web.onrender.com/api/health
4. 间隔: 每 10 分钟
```

---

## 故障排除

### Q1: 部署后还是报 "AI model not configured"

**原因**：环境变量没有正确保存或服务没有重启

**解决**：
1. 确认环境变量已添加（Environment 标签页能看到）
2. 手动触发重新部署：Dashboard → Manual Deploy → Deploy latest commit

### Q2: Redis 连接失败

**原因**：REDIS_URL 格式错误或 Upstash 数据库未创建

**解决**：
1. 确认 URL 格式：`rediss://default:密码@主机:6379`（注意是 `rediss` 两个 s）
2. 测试连接：`redis-cli --tls -u "你的URL" ping`

### Q3: CORS 错误

**原因**：CORS_ORIGIN 配置错误

**解决**：
1. 确认 Server 的 CORS_ORIGIN 是 Web 的完整 URL
2. 格式：`https://nexusnote-web.onrender.com`（不要结尾斜杠）

### Q4: 数据库迁移失败

**原因**：DATABASE_URL 连接问题或 pgvector 扩展未安装

**解决**：
1. 检查 Render PostgreSQL 版本是否为 16
2. 查看 Server 启动日志中的迁移信息
3. 如果看到 `type "halfvec" does not exist`，说明 pgvector 未安装（但 Render PG16 应该自带）

### Q5: 构建失败

```bash
# 检查 package.json 中的 build 脚本
# Render 日志查看详细错误
```

### Q6: WebSocket 不工作

```bash
# Render 免费版支持 WebSocket
# 确保 NEXT_PUBLIC_COLLAB_URL 使用 wss:// 而非 ws://
```

---

## 自定义域名（可选）

```
Settings → Custom Domain → 添加你的域名
→ 配置 DNS CNAME 记录
→ 自动申请 SSL 证书
```

---

## 安全建议

### 生产环境

1. **定期轮换密钥**：每 90 天更换 JWT_SECRET 和 API Keys
2. **使用 Render Secrets**：敏感信息不要写在 render.yaml
3. **限制 CORS**：只允许你的域名访问
4. **监控 API 用量**：设置 DeepSeek/302.ai 的用量告警

### API Key 管理

```bash
# 开发环境：使用 .env（不提交到 Git）
DEEPSEEK_API_KEY=sk-dev-xxx

# 生产环境：使用 Render Environment Variables
# 通过 Dashboard 手动添加，不写在代码里
```

---

## 成本对比

| 方案 | 月成本 | 性能 | 需要卡 |
|------|--------|------|--------|
| Render Free | $0 | 有休眠 | ❌ |
| Oracle Cloud | $0 | **无休眠** | ✅ |
| 阿里云 | ~¥60 | 无休眠 | ❌ |

**建议**：先用 Render 免费试用，确认喜欢后再决定是否升级到 Oracle。

---

## 升级到付费版（可选）

```
Render Starter: $7/月
- 无休眠
- 更多资源
- 专用 IP
```

如果确定要长期使用，建议：
- 花 ¥70 开 WildCard → 注册 Oracle Cloud → 永久免费 4核 24GB

---

## 下一步

配置完成后：

1. ✅ 提交 render.yaml 的修改（CORS_ORIGIN）
2. ✅ 在 Render Dashboard 添加所有环境变量
3. ✅ 等待自动部署完成
4. ✅ 测试所有功能
5. ✅ 设置自定义域名（可选）

---

## 需要帮助？

如果配置后还有问题，提供以下信息：

1. Server 的完整启动日志（前 50 行）
2. 具体的错误信息
3. 已配置的环境变量列表（隐藏密钥值）

我会帮你精确定位问题！
