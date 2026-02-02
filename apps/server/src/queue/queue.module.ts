import { Module, Global } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { env, defaults } from '@nexusnote/config'
import { Queue } from 'bullmq'

export interface RagIndexJob {
  documentId: string
  plainText: string
}

// Standalone queue instance for non-DI usage (e.g. Hocuspocus)
export const ragQueue = new Queue('rag-processing', {
  connection: {
    url: env.REDIS_URL,
  },
})

@Global()
@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        url: env.REDIS_URL,
      },
    }),
    BullModule.registerQueue({
      name: 'rag-processing',
      defaultJobOptions: {
        attempts: env.QUEUE_RAG_MAX_RETRIES || defaults.queue.ragMaxRetries,
        backoff: {
          type: 'exponential',
          delay: env.QUEUE_RAG_BACKOFF_DELAY || defaults.queue.ragBackoffDelay,
        },
        removeOnComplete: true,
      },
    }),
  ],
  exports: [BullModule],
})
export class QueueModule {}

// Helper function to add jobs to the queue
export async function addRagIndexJob(data: RagIndexJob) {
  await ragQueue.add('index-document', data, {
    // Deduplication: keep only the latest job for the same document
    jobId: `rag-${data.documentId}`,
    removeOnComplete: true,
    removeOnFail: 100,
  })
  console.log(`[Queue] Added RAG index job for: ${data.documentId}`)
}
