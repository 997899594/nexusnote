import { Controller, Get, Post, Patch, Param, Body } from '@nestjs/common'
import { DocumentService } from './document.service'

@Controller('documents')
export class DocumentController {
  constructor(private readonly documentService: DocumentService) { }

  @Get()
  async findAll() {
    return this.documentService.findAll()
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.documentService.findOne(id)
  }

  @Post()
  async create(@Body() data: { title: string }) {
    return this.documentService.create(data.title)
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() data: Partial<{ title: string; isVault: boolean }>
  ) {
    return this.documentService.update(id, data)
  }
}
