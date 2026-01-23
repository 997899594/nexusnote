import { Module, Global, OnModuleInit, OnModuleDestroy } from '@nestjs/common'
import { Queue, Worker, Job } from 'bullmq'
import IORedis from 'ioredis'
import { env } from '../config/env.config'

// Redis 连接
const connection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
})

// RAG 索引队列
export const ragQueue = new Queue('rag-index', { connection: connection as any })

export interface RagIndexJob {
  documentId: string
  plainText: string
}

@Global()
@Module({
  providers: [
    {
      provide: 'RAG_QUEUE',
      useValue: ragQueue,
    },
    {
      provide: 'REDIS_CONNECTION',
      useValue: connection,
    },
  ],
  exports: ['RAG_QUEUE', 'REDIS_CONNECTION'],
})
export class QueueModule implements OnModuleDestroy {
  async onModuleDestroy() {
    await ragQueue.close()
    await connection.quit()
  }
}

// 添加任务到队列的辅助函数
export async function addRagIndexJob(data: RagIndexJob) {
  await ragQueue.add('index-document', data, {
    // 去重：同一文档只保留最新的任务
    jobId: `rag-${data.documentId}`,
    removeOnComplete: true,
    removeOnFail: 100,
  })
  console.log(`[Queue] Added RAG index job for: ${data.documentId}`)
}
