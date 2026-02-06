/**
 * PM2 Ecosystem Configuration
 *
 * 在单一 Docker 容器中管理多个进程：
 * - Next.js API 服务器 (port 3002)
 * - Hocuspocus WebSocket 服务器 (port 1234)
 * - BullMQ RAG 索引 Worker
 * - BullMQ UI (可选，用于监控)
 */

module.exports = {
  apps: [
    {
      // Next.js API 服务器 (使用 Standalone 输出)
      name: 'next-api',
      script: 'apps/web/server.js',
      env: {
        NODE_ENV: 'production',
        PORT: 3002,
      },
      instances: 1,
      exec_mode: 'cluster',
      max_memory_restart: '512M',
      error_file: 'logs/next-api.err.log',
      out_file: 'logs/next-api.out.log',
      merge_logs: true,
    },

    {
      // Hocuspocus WebSocket 服务器 (使用编译后的 JS)
      name: 'hocuspocus',
      script: 'apps/web/hocuspocus.js',
      env: {
        NODE_ENV: 'production',
        PORT: 1234,
      },
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '256M',
      error_file: 'logs/hocuspocus.err.log',
      out_file: 'logs/hocuspocus.out.log',
      merge_logs: true,
    },

    {
      // BullMQ RAG 索引 Worker (使用编译后的 JS)
      name: 'rag-worker',
      script: 'apps/web/worker.js',
      env: {
        NODE_ENV: 'production',
      },
      instances: 1, // 单个 worker，并发由 BullMQ 内部控制
      exec_mode: 'fork',
      max_memory_restart: '512M',
      error_file: 'logs/rag-worker.err.log',
      out_file: 'logs/rag-worker.out.log',
      merge_logs: true,
      // 如果 worker 退出，自动重启
      autorestart: true,
      watch: false, // 生产环境下不监听文件变化
    },
  ],

  // 部署配置
  deploy: {
    production: {
      user: 'root',
      host: 'your-server-ip',
      ref: 'origin/main',
      repo: 'git@github.com:your-repo.git',
      path: '/var/www/nexusnote',
      'pre-deploy-local': 'echo "Pre-deploying..."',
      'post-deploy':
        'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
      'pre-deploy': 'pm2 kill || true',
    },
  },
};
