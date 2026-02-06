/**
 * Hocuspocus WebSocket Server for Collaboration
 *
 * 在 Next.js 旁边运行的 WebSocket 服务器
 * 用于实时协作编辑功能
 *
 * 启动方式：
 * - 开发: PORT=1234 node server.js
 * - 生产: 使用进程管理器（pm2/systemd）
 */

const { Server } = require('@hocuspocus/server');
const { Database } = require('@hocuspocus/extension-database');
const { Redis } = require('@hocuspocus/extension-redis');
const { WebSocketServer } = require('ws');
const http = require('http');
const IORedis = require('ioredis');

// 获取环境变量
const PORT = process.env.PORT || 1234;
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const DATABASE_URL = process.env.DATABASE_URL;

console.log(`[Hocuspocus] Starting WebSocket server on port ${PORT}...`);
console.log(`[Hocuspocus] REDIS_URL: ${REDIS_URL}`);

// 创建 HTTP 服务器
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Hocuspocus WebSocket Server running\n');
});

// 创建 Hocuspocus 服务器实例
const hocuspocusServer = Server.configure({
  port: PORT,
  address: '0.0.0.0',

  extensions: [
    // 数据库持久化扩展（如果配置了 DATABASE_URL）
    ...(DATABASE_URL ? [{
      onStoreDocument: async (data) => {
        console.log(`[Hocuspocus] Storing document: ${data.documentName}`);
        // 这里可以集成数据库保存逻辑
        // 简化版：只记录日志
      },
      onLoadDocument: async (data) => {
        console.log(`[Hocuspocus] Loading document: ${data.documentName}`);
        // 这里可以从数据库加载文档
      },
    }] : []),

    // Redis 扩展（用于分布式锁）
    ...(REDIS_URL ? [{
      onUpdate: async (data) => {
        // 简化版：RAG 索引触发可以在这里处理
        console.log(`[Hocuspocus] Document updated: ${data.documentName}`);
      },
    }] : []),
  ],

  // 认证回调（可选）
  onConnect: (data) => {
    console.log(`[Hocuspocus] Client connected: ${data.documentName}`);
    return true; // 允许连接
  },

  onDisconnect: (data) => {
    console.log(`[Hocuspocus] Client disconnected: ${data.documentName}`);
  },

  onChange: (data) => {
    // 文档变更时的回调
    // 这里可以触发 RAG 索引任务
  },

  onAwarenessChange: (data) => {
    // 感知变更（光标位置、用户选择等）
  },
});

// 启动服务器
hocuspocusServer.listen().then(() => {
  console.log(`[Hocuspocus] ✅ Server listening on port ${PORT}`);
  console.log(`[Hocuspocus] WebSocket: ws://localhost:${PORT}`);
}).catch((err) => {
  console.error(`[Hocuspocus] ❌ Failed to start server:`, err);
  process.exit(1);
});

// 优雅关闭
process.on('SIGTERM', async () => {
  console.log('[Hocuspocus] SIGTERM received, shutting down...');
  await hocuspocusServer.destroy();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[Hocuspocus] SIGINT received, shutting down...');
  await hocuspocusServer.destroy();
  process.exit(0);
});
