import { Injectable } from '@nestjs/common'

// 临时内存存储 - Phase 2 替换为 Drizzle + Postgres
const documents = new Map<string, { id: string; title: string; createdAt: Date }>()

@Injectable()
export class DocumentService {
  async findAll() {
    return Array.from(documents.values())
  }

  async findOne(id: string) {
    return documents.get(id) || null
  }

  async create(title: string) {
    const id = crypto.randomUUID()
    const doc = {
      id,
      title,
      createdAt: new Date(),
    }
    documents.set(id, doc)
    return doc
  }
}
