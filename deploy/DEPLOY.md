# NexusNote 免费部署指南

## 方案选择

| 方案 | 成本 | 难度 | 推荐 |
|------|------|------|------|
| Oracle Cloud | 永久免费 | ⭐⭐ | ✅ 最推荐 |
| Vercel + Fly.io + Neon | $0 | ⭐⭐ | 适合前端开发者 |
| 自有 VPS | $6/月起 | ⭐⭐ | 已有服务器 |

---

## 方案 A: Oracle Cloud 永久免费 (推荐)

### 1. 注册 Oracle Cloud
1. 访问 https://www.oracle.com/cloud/free/
2. 注册账号 (需要信用卡验证，但不会扣费)
3. 创建 **永久免费 ARM 实例**:
   - 镜像: Ubuntu 22.04
   - 配置: 4 OCPU + 24GB RAM (免费额度内)

### 2. 服务器初始化
```bash
# SSH 连接到服务器
ssh ubuntu@your-server-ip

# 安装 Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# 安装 Docker Compose
sudo apt install docker-compose-plugin

# 重新登录以生效
exit
ssh ubuntu@your-server-ip
```

### 3. 部署应用
```bash
# 克隆代码
git clone https://github.com/your-username/nexusnote.git
cd nexusnote

# 配置环境变量
cp .env.example .env
nano .env  # 编辑配置，填入你的 AI API Key

# 启动所有服务
docker compose --profile production up -d

# 查看日志
docker compose logs -f
```

### 4. 配置防火墙
```bash
# Oracle Cloud 控制台 -> 网络 -> 安全列表 -> 添加入站规则:
# - 端口 80 (HTTP)
# - 端口 443 (HTTPS)
# - 端口 3000 (Next.js，可选)
# - 端口 3001 (API，可选)
# - 端口 1234 (WebSocket，可选)
```

### 5. 配置域名 (可选)
```bash
# 如果有域名，配置 DNS A 记录指向服务器 IP
# 然后申请 SSL 证书:
docker run -it --rm \
  -v ./deploy/certbot/conf:/etc/letsencrypt \
  -v ./deploy/certbot/www:/var/www/certbot \
  certbot/certbot certonly --webroot \
  -w /var/www/certbot \
  -d your-domain.com

# 启用 nginx 的 HTTPS 配置
nano deploy/nginx.conf  # 取消注释 SSL 相关配置
docker compose restart nginx
```

---

## 方案 B: Vercel + Fly.io + Neon

### 1. 部署前端到 Vercel
```bash
# 安装 Vercel CLI
npm i -g vercel

# 部署
cd apps/web
vercel

# 设置环境变量 (Vercel 控制台)
NEXT_PUBLIC_API_URL=https://your-app.fly.dev
NEXT_PUBLIC_COLLAB_URL=wss://your-app.fly.dev
AI_API_KEY=xxx
```

### 2. 部署后端到 Fly.io
```bash
# 安装 Fly CLI
curl -L https://fly.io/install.sh | sh

# 登录
fly auth login

# 创建应用
cd apps/server
fly launch --no-deploy

# 设置环境变量
fly secrets set DATABASE_URL="postgresql://..." AI_API_KEY="sk-xxx"

# 部署
fly deploy
```

### 3. 创建 Neon 数据库
1. 访问 https://neon.tech
2. 创建项目 (免费 512MB)
3. 启用 pgvector: `CREATE EXTENSION vector;`
4. 复制连接字符串

---

## 常用命令

```bash
# 启动生产环境
docker compose --profile production up -d

# 查看日志
docker compose logs -f web
docker compose logs -f server

# 重启服务
docker compose restart

# 停止服务
docker compose down

# 更新代码并重新部署
git pull
docker compose --profile production build
docker compose --profile production up -d

# 备份数据库
docker exec nexusnote-db pg_dump -U postgres nexusnote > backup.sql

# 恢复数据库
cat backup.sql | docker exec -i nexusnote-db psql -U postgres nexusnote
```

---

## 环境变量说明

| 变量 | 说明 | 示例 |
|------|------|------|
| `AI_API_KEY` | AI 服务 API Key | `sk-xxx` |
| `AI_BASE_URL` | AI API 地址 | `https://api.302.ai/v1` |
| `AI_CHAT_MODEL` | 聊天模型 | `gpt-4o-mini` |
| `POSTGRES_PASSWORD` | 数据库密码 | `secure-password` |
| `PUBLIC_API_URL` | 后端 API 地址 | `https://api.your-domain.com` |
| `PUBLIC_COLLAB_URL` | 协作 WebSocket 地址 | `wss://collab.your-domain.com` |

---

## 故障排除

### 数据库连接失败
```bash
# 检查 PostgreSQL 是否运行
docker compose ps postgres

# 查看日志
docker compose logs postgres
```

### WebSocket 连接失败
```bash
# 检查 1234 端口
netstat -tlnp | grep 1234

# 检查防火墙
sudo ufw status
```

### AI 功能不工作
```bash
# 检查 API Key 配置
docker compose exec server env | grep AI

# 测试 AI 连接
curl -X POST https://api.302.ai/v1/chat/completions \
  -H "Authorization: Bearer $AI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"hi"}]}'
```
