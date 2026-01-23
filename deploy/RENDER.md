# Render 免费部署指南

**零成本，无需信用卡，5分钟部署**

---

## 优势

✅ 完全免费
✅ 无需信用卡
✅ GitHub 登录即可
✅ 自动 HTTPS
✅ 支持 PostgreSQL + pgvector

## 限制

⚠️ 15分钟无请求会休眠（冷启动 ~30秒）
⚠️ 免费 PostgreSQL 只有 1GB（够用）
⚠️ 适合个人/演示项目

---

## 部署步骤

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

部署后，进入每个服务设置环境变量：

#### nexusnote-server
```
AI_PROVIDER=302ai
AI_API_KEY=sk-your-api-key
AI_BASE_URL=https://api.302.ai/v1
```

#### nexusnote-web
```
AI_PROVIDER=302ai
AI_API_KEY=sk-your-api-key
AI_BASE_URL=https://api.302.ai/v1
```

### 5. 启用 pgvector

```bash
# Dashboard → nexusnote-db → Connect → Shell
# 执行:
CREATE EXTENSION vector;
```

### 6. 完成！

访问 `https://nexusnote-web.onrender.com`

---

## 自定义域名（可选）

```
Settings → Custom Domain → 添加你的域名
→ 配置 DNS CNAME 记录
→ 自动申请 SSL 证书
```

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

### 构建失败

```bash
# 检查 package.json 中的 build 脚本
# Render 日志查看详细错误
```

### 数据库连接失败

```bash
# 检查 DATABASE_URL 是否正确配置
# Render 自动注入，通常无需手动设置
```

### WebSocket 不工作

```bash
# Render 免费版支持 WebSocket
# 确保 NEXT_PUBLIC_COLLAB_URL 使用 wss:// 而非 ws://
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
