/**
 * NexusNote Local-First Storage Layer
 *
 * 基于 IndexedDB 的本地优先存储，使用 Yjs CRDT 实现冲突无关同步
 *
 * 架构：
 * - 本地 IndexedDB 为主数据源（离线完整可用）
 * - 服务器为可选同步目标（有网络时后台同步）
 * - Yjs CRDT 自动解决并发冲突
 */

const DB_NAME = 'nexusnote-local'
const DB_VERSION = 2

// Store names
export const STORES = {
  DOCUMENTS: 'documents',
  SNAPSHOTS: 'snapshots',
  SYNC_STATE: 'sync_state',
  METADATA: 'metadata',
  // Learning module stores
  LEARNING_CONTENTS: 'learning_contents',
  LEARNING_CHAPTERS: 'learning_chapters',
  LEARNING_PROGRESS: 'learning_progress',
  LEARNING_HIGHLIGHTS: 'learning_highlights',
} as const

// Document stored locally
export interface LocalDocument {
  id: string
  title: string
  yjsState: Uint8Array      // Yjs 编码的完整文档状态
  yjsStateVector: Uint8Array // Yjs 状态向量（用于增量同步）
  plainText: string          // 纯文本（用于本地搜索）
  createdAt: number
  updatedAt: number
  syncedAt: number | null    // null = 从未同步到服务器
  isDirty: boolean           // 有未同步的本地更改
  isDeleted: boolean         // 软删除标记
}

// Snapshot for timeline
export interface DocumentSnapshot {
  id: string
  documentId: string
  yjsState: Uint8Array
  plainText: string
  timestamp: number
  trigger: 'auto' | 'manual' | 'ai_edit' | 'collab_join' | 'restore'
  summary?: string           // AI 生成的变更摘要
  wordCount: number
  diffFromPrevious?: {
    added: number
    removed: number
  }
}

// Sync state tracking
export interface SyncState {
  documentId: string
  lastSyncedAt: number
  serverStateVector: Uint8Array | null
  pendingUpdates: Uint8Array[]  // 待同步的 Yjs updates
  conflictResolved: boolean
}

// Metadata store
export interface LocalMetadata {
  key: string
  value: any
}

// ============================================
// Learning Module Interfaces
// ============================================

export type LearningContentType = 'book' | 'article' | 'course'
export type LearningDifficulty = 'beginner' | 'intermediate' | 'advanced'

export interface LocalLearningContent {
  id: string
  title: string
  type: LearningContentType
  author?: string
  coverUrl?: string
  sourceUrl?: string
  totalChapters: number
  difficulty: LearningDifficulty
  estimatedMinutes?: number
  tags: string[]
  summary?: string
  createdAt: number
  updatedAt: number
  syncedAt: number | null
  isDirty: boolean
}

export interface LocalLearningChapter {
  id: string
  contentId: string
  documentId: string  // 关联到 documents 表
  chapterIndex: number
  title: string
  summary?: string
  keyPoints: string[]
  createdAt: number
}

export interface LocalLearningProgress {
  id: string
  contentId: string
  currentChapter: number
  completedChapters: number[]
  totalTimeSpent: number  // 分钟
  lastAccessedAt: number
  startedAt: number
  completedAt?: number
  masteryLevel: number  // 0-100
}

export interface LocalLearningHighlight {
  id: string
  chapterId: string
  content: string
  note?: string
  color: 'yellow' | 'green' | 'blue' | 'pink' | 'purple'
  position: number
  createdAt: number
}

class LocalDatabase {
  private db: IDBDatabase | null = null
  private initPromise: Promise<IDBDatabase> | null = null

  async init(): Promise<IDBDatabase> {
    if (this.db) return this.db
    if (this.initPromise) return this.initPromise

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => {
        console.error('[LocalDB] Failed to open database:', request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        this.db = request.result
        console.log('[LocalDB] Database opened successfully')
        resolve(this.db)
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        console.log('[LocalDB] Upgrading database schema...')

        // Documents store
        if (!db.objectStoreNames.contains(STORES.DOCUMENTS)) {
          const docStore = db.createObjectStore(STORES.DOCUMENTS, { keyPath: 'id' })
          docStore.createIndex('updatedAt', 'updatedAt', { unique: false })
          docStore.createIndex('isDirty', 'isDirty', { unique: false })
          docStore.createIndex('isDeleted', 'isDeleted', { unique: false })
        }

        // Snapshots store
        if (!db.objectStoreNames.contains(STORES.SNAPSHOTS)) {
          const snapStore = db.createObjectStore(STORES.SNAPSHOTS, { keyPath: 'id' })
          snapStore.createIndex('documentId', 'documentId', { unique: false })
          snapStore.createIndex('timestamp', 'timestamp', { unique: false })
          snapStore.createIndex('documentId_timestamp', ['documentId', 'timestamp'], { unique: false })
        }

        // Sync state store
        if (!db.objectStoreNames.contains(STORES.SYNC_STATE)) {
          db.createObjectStore(STORES.SYNC_STATE, { keyPath: 'documentId' })
        }

        // Metadata store
        if (!db.objectStoreNames.contains(STORES.METADATA)) {
          db.createObjectStore(STORES.METADATA, { keyPath: 'key' })
        }

        // Learning contents store
        if (!db.objectStoreNames.contains(STORES.LEARNING_CONTENTS)) {
          const contentStore = db.createObjectStore(STORES.LEARNING_CONTENTS, { keyPath: 'id' })
          contentStore.createIndex('type', 'type', { unique: false })
          contentStore.createIndex('updatedAt', 'updatedAt', { unique: false })
        }

        // Learning chapters store
        if (!db.objectStoreNames.contains(STORES.LEARNING_CHAPTERS)) {
          const chapterStore = db.createObjectStore(STORES.LEARNING_CHAPTERS, { keyPath: 'id' })
          chapterStore.createIndex('contentId', 'contentId', { unique: false })
          chapterStore.createIndex('documentId', 'documentId', { unique: false })
        }

        // Learning progress store
        if (!db.objectStoreNames.contains(STORES.LEARNING_PROGRESS)) {
          const progressStore = db.createObjectStore(STORES.LEARNING_PROGRESS, { keyPath: 'id' })
          progressStore.createIndex('contentId', 'contentId', { unique: false })
        }

        // Learning highlights store
        if (!db.objectStoreNames.contains(STORES.LEARNING_HIGHLIGHTS)) {
          const highlightStore = db.createObjectStore(STORES.LEARNING_HIGHLIGHTS, { keyPath: 'id' })
          highlightStore.createIndex('chapterId', 'chapterId', { unique: false })
        }

        console.log('[LocalDB] Schema upgrade complete')
      }
    })

    return this.initPromise
  }

  private async getStore(storeName: string, mode: IDBTransactionMode = 'readonly'): Promise<IDBObjectStore> {
    const db = await this.init()
    const transaction = db.transaction(storeName, mode)
    return transaction.objectStore(storeName)
  }

  // Generic CRUD operations
  async get<T>(storeName: string, key: string): Promise<T | undefined> {
    const store = await this.getStore(storeName)
    return new Promise((resolve, reject) => {
      const request = store.get(key)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  async put<T>(storeName: string, value: T): Promise<void> {
    const store = await this.getStore(storeName, 'readwrite')
    return new Promise((resolve, reject) => {
      const request = store.put(value)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async delete(storeName: string, key: string): Promise<void> {
    const store = await this.getStore(storeName, 'readwrite')
    return new Promise((resolve, reject) => {
      const request = store.delete(key)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async getAll<T>(storeName: string): Promise<T[]> {
    const store = await this.getStore(storeName)
    return new Promise((resolve, reject) => {
      const request = store.getAll()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  async getAllByIndex<T>(storeName: string, indexName: string, value: IDBValidKey): Promise<T[]> {
    const store = await this.getStore(storeName)
    const index = store.index(indexName)
    return new Promise((resolve, reject) => {
      const request = index.getAll(value)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  async count(storeName: string): Promise<number> {
    const store = await this.getStore(storeName)
    return new Promise((resolve, reject) => {
      const request = store.count()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  async clear(storeName: string): Promise<void> {
    const store = await this.getStore(storeName, 'readwrite')
    return new Promise((resolve, reject) => {
      const request = store.clear()
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  // Cursor-based iteration for large datasets
  async iterate<T>(
    storeName: string,
    callback: (value: T, cursor: IDBCursorWithValue) => void | Promise<void>,
    indexName?: string,
    range?: IDBKeyRange
  ): Promise<void> {
    const store = await this.getStore(storeName)
    const target = indexName ? store.index(indexName) : store

    return new Promise((resolve, reject) => {
      const request = target.openCursor(range)
      request.onsuccess = async () => {
        const cursor = request.result
        if (cursor) {
          await callback(cursor.value, cursor)
          cursor.continue()
        } else {
          resolve()
        }
      }
      request.onerror = () => reject(request.error)
    })
  }
}

// Singleton instance
export const localDb = new LocalDatabase()

// Initialize on import (browser only)
if (typeof window !== 'undefined') {
  localDb.init().catch(console.error)
}
