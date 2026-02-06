# NexusNote 部署指南

## 架构概述

NexusNote 现在是一个完整的 Next.js Fullstack 应用，在单一 Docker 容器中运行以下组件：

1. **Next.js API Gateway** (端口 3002) - HTTP API 服务
2. **Hocuspocus WebSocket** (端口 1234) - 实时协作编辑
3. **BullMQ Worker** - 后台任务处理（RAG 索引）

所有进程由 PM2 管理，支持故障自动恢复。

## 本地开发

### 前置要求
- Node.js 20+
- PostgreSQL 16+ (with pgvector)
- Redis 7+
- pnpm 8+

### 快速启动

```bash
# 1. 安装依赖
pnpm install

# 2. 迁移数据库
pnpm exec drizzle-kit push

# 3. 启动所有服务（终端1）
pnpm dev

# 4. 启动后台 Worker（终端2）
cd apps/web
npm run queue:worker

# 5. 启动 Hocuspocus（终端3）
npm run hocuspocus
```

或者使用 PM2 一次启动所有服务：

```bash
cd apps/web
npm install -g pm2 tsx
npm run pm2:start

# 查看日志
npm run pm2:logs

# 停止所有进程
npm run pm2:stop
```

### 环境变量配置

创建 `apps/web/.env.local`:

```env
# 数据库
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/nexusnote
REDIS_URL=redis://localhost:6379

# 服务器配置
PORT=3002
HOCUSPOCUS_PORT=1234

# 认证
AUTH_SECRET=your-secret-key-change-in-production
JWT_SECRET=your-jwt-secret

# AI 配置
AI_MODEL=gemini-3-flash-preview
AI_302_API_KEY=your-api-key  # 或其他 AI provider

# 可选：Langfuse
LANGFUSE_PUBLIC_KEY=
LANGFUSE_SECRET_KEY=
```

## Docker 部署

### 构建和运行

```bash
# 构建镜像
docker build -f apps/web/Dockerfile -t nexusnote:latest .

# 运行容器
docker run -d \
  --name nexusnote \
  -p 3002:3002 \
  -p 1234:1234 \
  -e DATABASE_URL=postgresql://... \
  -e REDIS_URL=redis://... \
  -e AI_302_API_KEY=... \
  nexusnote:latest
```

### 使用 docker-compose

```bash
# 创建 .env 文件
cp .env.example .env

# 启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f app

# 停止服务
docker-compose down
```

## 处理流程

### 文档协作编辑流程

```
用户在编辑器中输入
        ↓
Hocuspocus WebSocket 接收更新
        ↓
提取纯文本 + 获取分布式锁
        ↓
更新数据库 plainText 字段
        ↓
添加 'rag-index' 任务到 BullMQ
        ↓
BullMQ Worker 处理任务
        ↓
分块文本（500字符，重叠50字符）
        ↓
调用 Embedding API 生成向量
        ↓
批量插入 documentChunks 表
        ↓
完成索引，文档可用于 RAG 搜索
```

### 搜索流程

```
用户发送查询
        ↓
AI 网关检查是否启用 RAG
        ↓
RAG Service 调用 /rag/search API
        ↓
搜索 documentChunks 表（基于向量相似度）
        ↓
返回最相关的文档片段
        ↓
AI 模型使用这些片段生成答案
```

## 监控和调试

### PM2 监控

```bash
# 查看进程状态
pm2 status

# 实时监控
pm2 monit

# 查看日志
pm2 logs next-api        # Next.js API
pm2 logs hocuspocus      # WebSocket 服务器
pm2 logs rag-worker      # RAG Worker

# 重启进程
pm2 restart next-api
pm2 restart all
```

### 数据库调试

```bash
# 连接到数据库
psql postgresql://postgres:postgres@localhost:5432/nexusnote

# 查看文档块
SELECT id, document_id, chunk_index, content::text FROM document_chunks LIMIT 5;

# 查看文档
SELECT id, title, plain_text::text FROM documents LIMIT 5;
```

### Redis 调试

```bash
# 连接到 Redis
redis-cli

# 查看队列
LLEN bull:rag-index:

# 查看锁
KEYS lock:rag-index:*

# 清空队列（谨慎！）
DEL bull:rag-index:
```

## 性能优化

### 并发配置

编辑 `apps/web/ecosystem.config.js` 或环境变量：

```env
# BullMQ Worker 并发数（default: 3）
QUEUE_RAG_CONCURRENCY=5

# 重试配置
QUEUE_RAG_MAX_RETRIES=3
QUEUE_RAG_BACKOFF_DELAY=1000
```

### 分块大小调整

```env
# 文本分块大小（characters）
RAG_CHUNK_SIZE=500

# 块之间的重叠
RAG_CHUNK_OVERLAP=50
```

### RAG 搜索参数

```env
# 相似度阈值（0-1，higher = more strict）
RAG_SIMILARITY_THRESHOLD=0.3

# 返回结果数
# 见代码中的 defaults.rag.topK = 5
```

## 故障排查

### BullMQ 任务堆积

如果任务堆积，检查 Worker 是否正常运行：

```bash
# 检查 Worker 日志
pm2 logs rag-worker

# 检查 Redis 连接
redis-cli ping

# 查看任务队列状态
redis-cli
> LLEN bull:rag-index:${prefix}:wait
```

### Hocuspocus 连接问题

```bash
# 检查 WebSocket 连接
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" \
  http://localhost:1234/

# 查看日志
pm2 logs hocuspocus
```

### Embedding 失败

```bash
# 检查 Embedding API 连接
curl -X POST http://api.siliconflow.cn/v1/embeddings \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"Qwen/Qwen3-Embedding-8B","input":["test"]}'
```

## 升级和维护

### 安全更新

```bash
# 更新依赖
pnpm update

# 构建新镜像
docker build -f apps/web/Dockerfile -t nexusnote:latest .

# 重启容器
docker-compose up -d
```

### 数据库迁移

```bash
# 生成新迁移
pnpm drizzle-kit generate

# 应用迁移
pnpm drizzle-kit push

# 在 Docker 中
docker-compose exec app pnpm drizzle-kit push
```

### 备份

```bash
# PostgreSQL 备份
pg_dump postgresql://user:pass@host:5432/nexusnote > backup.sql

# Redis 备份（如果启用了持久化）
docker-compose exec redis redis-cli BGSAVE
docker cp nexusnote-redis:/data/dump.rdb ./backup.rdb
```

## 生产检查清单

- [ ] 修改所有默认密钥（AUTH_SECRET, JWT_SECRET）
- [ ] 配置 AI 提供商 API 密钥
- [ ] 启用 HTTPS（使用 nginx 反向代理）
- [ ] 配置日志收集和监控
- [ ] 设置定期备份策略
- [ ] 配置防火墙规则（仅允许 80, 443, 3002）
- [ ] 启用 PostgreSQL 自动备份
- [ ] 配置 Redis 持久化
- [ ] 设置告警规则
- [ ] 配置 CDN（如适用）

## 联系方式

如有问题，请提交 Issue 或 PR。
