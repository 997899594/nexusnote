import { pgTable, uuid, text, timestamp, integer, customType } from 'drizzle-orm/pg-core'

// 自定义 bytea 类型
const bytea = customType<{ data: Buffer }>({
  dataType() {
    return 'bytea'
  },
})

// halfvec: 半精度向量，支持 4000 维度 + 省 50% 存储
// 2026: Qwen3-Embedding-8B (MTEB #1)
const EMBEDDING_DIMENSIONS = process.env.EMBEDDING_DIMENSIONS || '4000'

const halfvec = customType<{ data: number[] }>({
  dataType() {
    return `halfvec(${EMBEDDING_DIMENSIONS})`
  },
  toDriver(value: number[]) {
    return `[${value.join(',')}]`
  },
})

// 用户表
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name'),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

// 工作区表
export const workspaces = pgTable('workspaces', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  ownerId: uuid('owner_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

// 文档表
export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull().default('Untitled'),
  workspaceId: uuid('workspace_id').references(() => workspaces.id),
  content: bytea('content'), // Yjs 二进制状态
  plainText: text('plain_text'), // 纯文本（用于搜索和 RAG）
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

// 文档分块表（RAG 用）
export const documentChunks = pgTable('document_chunks', {
  id: uuid('id').primaryKey().defaultRandom(),
  documentId: uuid('document_id').references(() => documents.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  embedding: halfvec('embedding'),
  chunkIndex: integer('chunk_index').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
})

// 类型导出
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Document = typeof documents.$inferSelect
export type NewDocument = typeof documents.$inferInsert
export type DocumentChunk = typeof documentChunks.$inferSelect
export type NewDocumentChunk = typeof documentChunks.$inferInsert
