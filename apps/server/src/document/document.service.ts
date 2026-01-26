import { Injectable, Inject, NotFoundException } from '@nestjs/common'
import { db } from '../database/database.module'
import { documents } from '@nexusnote/db'
import { eq } from 'drizzle-orm'

@Injectable()
export class DocumentService {
  async findAll() {
    return db.select().from(documents)
  }

  async findOne(id: string) {
    const result = await db.select()
      .from(documents)
      .where(eq(documents.id, id))
      .limit(1)

    return result[0] || null
  }

  async create(title: string) {
    const [doc] = await db.insert(documents).values({
      title,
    }).returning()
    return doc
  }

  async update(id: string, data: Partial<{ title: string; isVault: boolean }>) {
    const [updated] = await db.update(documents)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(documents.id, id))
      .returning()

    if (!updated) {
      throw new NotFoundException(`Document with ID ${id} not found`)
    }

    return updated
  }
}
