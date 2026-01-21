import { Controller, Post, Body, Get, Query } from '@nestjs/common'
import { RagService } from './rag.service'

@Controller('rag')
export class RagController {
  constructor(private readonly ragService: RagService) {}

  // 手动触发索引（调试用）
  @Post('index')
  async indexDocument(@Body() body: { documentId: string; plainText: string }) {
    await this.ragService.indexDocument(body.documentId, body.plainText)
    return { success: true }
  }

  // 检索测试
  @Get('search')
  async search(@Query('q') query: string, @Query('topK') topK?: string) {
    const results = await this.ragService.retrieve(query, topK ? parseInt(topK) : 5)

    // 附加文档标题
    const enriched = await Promise.all(
      results.map(async (r) => ({
        ...r,
        documentTitle: await this.ragService.getDocumentTitle(r.documentId),
      }))
    )

    return enriched
  }
}
