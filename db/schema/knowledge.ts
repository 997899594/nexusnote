import { index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { embeddingVector } from "./shared";

export const knowledgeChunks = pgTable(
  "knowledge_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceType: text("source_type").notNull().default("note"),
    sourceId: uuid("source_id").notNull(),
    content: text("content").notNull(),
    embedding: embeddingVector("embedding"),
    chunkIndex: integer("chunk_index").notNull(),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    sourceIdx: index("knowledge_chunks_source_idx").on(table.sourceType, table.sourceId),
    userIdIdx: index("knowledge_chunks_user_id_idx").on(table.userId),
  }),
);

export const noteChunks = knowledgeChunks;

export type KnowledgeChunk = typeof knowledgeChunks.$inferSelect;
export type NewKnowledgeChunk = typeof knowledgeChunks.$inferInsert;
export type NoteChunk = KnowledgeChunk;
export type NewNoteChunk = NewKnowledgeChunk;
