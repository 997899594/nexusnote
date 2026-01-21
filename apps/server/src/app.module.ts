import { Module } from '@nestjs/common'
import { DocumentModule } from './document/document.module'
import { QueueModule } from './queue/queue.module'
import { RagModule } from './rag/rag.module'
import { HealthModule } from './health/health.module'

@Module({
  imports: [
    HealthModule,
    QueueModule,
    RagModule,
    DocumentModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
