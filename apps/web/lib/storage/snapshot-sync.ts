/**
 * Snapshot Sync - 快照云端同步
 *
 * 功能：
 * - 本地快照同步到服务器
 * - 从服务器拉取快照（跨设备）
 * - 增量同步（只传输新快照）
 */

import { localDb, STORES, DocumentSnapshot } from './local-db'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface ServerSnapshot {
  id: string
  documentId: string
  yjsState: string // base64
  plainText: string
  timestamp: number
  trigger: string
  summary?: string
  wordCount: number
  diffAdded?: number
  diffRemoved?: number
}

export class SnapshotSync {
  private syncInProgress = new Map<string, boolean>()

  /**
   * 同步本地快照到服务器
   */
  async pushToServer(documentId: string): Promise<number> {
    if (this.syncInProgress.get(documentId)) {
      console.log('[SnapshotSync] Sync already in progress for:', documentId)
      return 0
    }

    this.syncInProgress.set(documentId, true)

    try {
      // 获取服务器最新快照时间戳
      const serverLatest = await this.getServerLatestTimestamp(documentId)

      // 获取本地比服务器新的快照
      const localSnapshots = await localDb.getAllByIndex<DocumentSnapshot>(
        STORES.SNAPSHOTS,
        'documentId',
        documentId
      )

      const newSnapshots = localSnapshots.filter(
        snap => serverLatest === null || snap.timestamp > serverLatest
      )

      if (newSnapshots.length === 0) {
        console.log('[SnapshotSync] No new snapshots to sync for:', documentId)
        return 0
      }

      // 转换为服务器格式
      const serverSnapshots: ServerSnapshot[] = newSnapshots.map(snap => ({
        id: snap.id,
        documentId: snap.documentId,
        yjsState: this.uint8ArrayToBase64(snap.yjsState),
        plainText: snap.plainText,
        timestamp: snap.timestamp,
        trigger: snap.trigger,
        summary: snap.summary,
        wordCount: snap.wordCount,
        diffAdded: snap.diffFromPrevious?.added,
        diffRemoved: snap.diffFromPrevious?.removed,
      }))

      // 批量上传
      const response = await fetch(`${API_BASE}/snapshots/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshots: serverSnapshots }),
      })

      if (!response.ok) {
        throw new Error(`Sync failed: ${response.status}`)
      }

      console.log(`[SnapshotSync] Pushed ${newSnapshots.length} snapshots to server`)
      return newSnapshots.length
    } catch (error) {
      console.error('[SnapshotSync] Push failed:', error)
      throw error
    } finally {
      this.syncInProgress.set(documentId, false)
    }
  }

  /**
   * 从服务器拉取快照到本地
   */
  async pullFromServer(documentId: string): Promise<number> {
    try {
      // 获取本地最新快照时间戳
      const localSnapshots = await localDb.getAllByIndex<DocumentSnapshot>(
        STORES.SNAPSHOTS,
        'documentId',
        documentId
      )
      const localLatest = localSnapshots.length > 0
        ? Math.max(...localSnapshots.map(s => s.timestamp))
        : 0

      // 获取服务器快照
      const response = await fetch(`${API_BASE}/snapshots/${documentId}`)
      if (!response.ok) {
        throw new Error(`Fetch failed: ${response.status}`)
      }

      const { snapshots: serverSnapshots } = await response.json() as { snapshots: ServerSnapshot[] }

      // 筛选本地没有的快照
      const localIds = new Set(localSnapshots.map(s => s.id))
      const newSnapshots = serverSnapshots.filter(snap => !localIds.has(snap.id))

      if (newSnapshots.length === 0) {
        console.log('[SnapshotSync] No new snapshots from server for:', documentId)
        return 0
      }

      // 保存到本地
      for (const snap of newSnapshots) {
        const localSnap: DocumentSnapshot = {
          id: snap.id,
          documentId: snap.documentId,
          yjsState: this.base64ToUint8Array(snap.yjsState),
          plainText: snap.plainText,
          timestamp: snap.timestamp,
          trigger: snap.trigger as DocumentSnapshot['trigger'],
          summary: snap.summary,
          wordCount: snap.wordCount,
          diffFromPrevious: snap.diffAdded !== undefined ? {
            added: snap.diffAdded,
            removed: snap.diffRemoved || 0,
          } : undefined,
        }
        await localDb.put(STORES.SNAPSHOTS, localSnap)
      }

      console.log(`[SnapshotSync] Pulled ${newSnapshots.length} snapshots from server`)
      return newSnapshots.length
    } catch (error) {
      console.error('[SnapshotSync] Pull failed:', error)
      throw error
    }
  }

  /**
   * 双向同步
   */
  async sync(documentId: string): Promise<{ pushed: number; pulled: number }> {
    const pushed = await this.pushToServer(documentId)
    const pulled = await this.pullFromServer(documentId)
    return { pushed, pulled }
  }

  /**
   * 获取服务器最新快照时间戳
   */
  private async getServerLatestTimestamp(documentId: string): Promise<number | null> {
    try {
      const response = await fetch(`${API_BASE}/snapshots/${documentId}/latest-timestamp`)
      if (!response.ok) return null

      const { timestamp } = await response.json()
      return timestamp
    } catch {
      return null
    }
  }

  /**
   * 删除服务器快照
   */
  async deleteFromServer(snapshotId: string): Promise<void> {
    try {
      await fetch(`${API_BASE}/snapshots/${snapshotId}`, {
        method: 'DELETE',
      })
    } catch (error) {
      console.error('[SnapshotSync] Delete failed:', error)
    }
  }

  /**
   * 工具函数：Uint8Array 转 base64
   */
  private uint8ArrayToBase64(bytes: Uint8Array): string {
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  }

  /**
   * 工具函数：base64 转 Uint8Array
   */
  private base64ToUint8Array(base64: string): Uint8Array {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes
  }
}

// Singleton
export const snapshotSync = new SnapshotSync()
