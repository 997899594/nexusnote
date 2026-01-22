import { Injectable } from '@nestjs/common'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { eq, desc, and, gte, lte } from 'drizzle-orm'
import { documentSnapshots, documents } from '@nexusnote/db'

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/nexusnote'
const client = postgres(DATABASE_URL)
const db = drizzle(client)

// 每个文档最大快照数
const MAX_SNAPSHOTS_PER_DOC = 50

export interface SnapshotDTO {
  id: string
  documentId: string
  yjsState: string // base64 encoded
  plainText: string
  timestamp: number
  trigger: 'auto' | 'manual' | 'ai_edit' | 'collab_join' | 'restore'
  summary?: string
  wordCount: number
  diffAdded?: number
  diffRemoved?: number
}

@Injectable()
export class SnapshotService {
  /**
   * 保存快照到服务器
   */
  async saveSnapshot(snapshot: SnapshotDTO): Promise<void> {
    const yjsState = Buffer.from(snapshot.yjsState, 'base64')

    await db.insert(documentSnapshots).values({
      id: snapshot.id,
      documentId: snapshot.documentId,
      yjsState,
      plainText: snapshot.plainText,
      timestamp: new Date(snapshot.timestamp),
      trigger: snapshot.trigger,
      summary: snapshot.summary,
      wordCount: snapshot.wordCount,
      diffAdded: snapshot.diffAdded,
      diffRemoved: snapshot.diffRemoved,
    }).onConflictDoUpdate({
      target: documentSnapshots.id,
      set: {
        yjsState,
        plainText: snapshot.plainText,
        summary: snapshot.summary,
      },
    })

    console.log(`[Snapshot] Saved: ${snapshot.id}`)

    // 清理旧快照
    await this.pruneSnapshots(snapshot.documentId)
  }

  /**
   * 批量保存快照
   */
  async saveSnapshots(snapshots: SnapshotDTO[]): Promise<void> {
    for (const snapshot of snapshots) {
      await this.saveSnapshot(snapshot)
    }
  }

  /**
   * 获取文档的所有快照
   */
  async getSnapshots(documentId: string, limit = 100): Promise<SnapshotDTO[]> {
    const results = await db
      .select()
      .from(documentSnapshots)
      .where(eq(documentSnapshots.documentId, documentId))
      .orderBy(desc(documentSnapshots.timestamp))
      .limit(limit)

    return results.map(this.toDTO)
  }

  /**
   * 获取指定快照
   */
  async getSnapshot(snapshotId: string): Promise<SnapshotDTO | null> {
    const results = await db
      .select()
      .from(documentSnapshots)
      .where(eq(documentSnapshots.id, snapshotId))
      .limit(1)

    if (results.length === 0) return null
    return this.toDTO(results[0])
  }

  /**
   * 获取时间范围内的快照
   */
  async getSnapshotsByTimeRange(
    documentId: string,
    startTime: number,
    endTime: number
  ): Promise<SnapshotDTO[]> {
    const results = await db
      .select()
      .from(documentSnapshots)
      .where(
        and(
          eq(documentSnapshots.documentId, documentId),
          gte(documentSnapshots.timestamp, new Date(startTime)),
          lte(documentSnapshots.timestamp, new Date(endTime))
        )
      )
      .orderBy(desc(documentSnapshots.timestamp))

    return results.map(this.toDTO)
  }

  /**
   * 删除快照
   */
  async deleteSnapshot(snapshotId: string): Promise<void> {
    await db.delete(documentSnapshots).where(eq(documentSnapshots.id, snapshotId))
    console.log(`[Snapshot] Deleted: ${snapshotId}`)
  }

  /**
   * 获取最新快照的时间戳（用于增量同步）
   */
  async getLatestSnapshotTimestamp(documentId: string): Promise<number | null> {
    const results = await db
      .select({ timestamp: documentSnapshots.timestamp })
      .from(documentSnapshots)
      .where(eq(documentSnapshots.documentId, documentId))
      .orderBy(desc(documentSnapshots.timestamp))
      .limit(1)

    if (results.length === 0) return null
    return results[0].timestamp.getTime()
  }

  /**
   * 清理旧快照（保留最新 N 个）
   */
  private async pruneSnapshots(documentId: string): Promise<void> {
    const allSnapshots = await db
      .select({ id: documentSnapshots.id })
      .from(documentSnapshots)
      .where(eq(documentSnapshots.documentId, documentId))
      .orderBy(desc(documentSnapshots.timestamp))

    if (allSnapshots.length > MAX_SNAPSHOTS_PER_DOC) {
      const toDelete = allSnapshots.slice(MAX_SNAPSHOTS_PER_DOC)
      for (const snap of toDelete) {
        await db.delete(documentSnapshots).where(eq(documentSnapshots.id, snap.id))
      }
      console.log(`[Snapshot] Pruned ${toDelete.length} old snapshots for ${documentId}`)
    }
  }

  /**
   * 转换为 DTO
   */
  private toDTO(row: any): SnapshotDTO {
    return {
      id: row.id,
      documentId: row.documentId,
      yjsState: row.yjsState?.toString('base64') || '',
      plainText: row.plainText || '',
      timestamp: row.timestamp.getTime(),
      trigger: row.trigger as SnapshotDTO['trigger'],
      summary: row.summary || undefined,
      wordCount: row.wordCount || 0,
      diffAdded: row.diffAdded || undefined,
      diffRemoved: row.diffRemoved || undefined,
    }
  }
}
