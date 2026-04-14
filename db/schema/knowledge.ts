import {
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { embeddingVector } from "./shared";

export const knowledgeEvidenceEvents = pgTable(
  "knowledge_evidence_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    kind: text("kind").notNull(),
    sourceType: text("source_type").notNull(),
    sourceId: text("source_id"),
    sourceVersionHash: text("source_version_hash"),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    confidence: numeric("confidence", { precision: 4, scale: 3 }).notNull(),
    happenedAt: timestamp("happened_at").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userKindIdx: index("knowledge_evidence_events_user_kind_idx").on(table.userId, table.kind),
    userSourceIdx: index("knowledge_evidence_events_user_source_idx").on(
      table.userId,
      table.sourceType,
      table.sourceId,
    ),
    sourceVersionIdx: index("knowledge_evidence_events_source_version_idx").on(
      table.sourceVersionHash,
    ),
    happenedAtIdx: index("knowledge_evidence_events_happened_at_idx").on(table.happenedAt),
  }),
);

export const knowledgeEvidenceEventRefs = pgTable(
  "knowledge_evidence_event_refs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .references(() => knowledgeEvidenceEvents.id, { onDelete: "cascade" })
      .notNull(),
    refType: text("ref_type").notNull(),
    refId: text("ref_id").notNull(),
    snippet: text("snippet"),
    weight: numeric("weight", { precision: 5, scale: 3 }).notNull().default("1.000"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    eventIdx: index("knowledge_evidence_event_refs_event_idx").on(table.eventId),
    refIdx: index("knowledge_evidence_event_refs_ref_idx").on(table.refType, table.refId),
    uniqueEventRefIdx: uniqueIndex("knowledge_evidence_event_refs_unique_idx").on(
      table.eventId,
      table.refType,
      table.refId,
    ),
  }),
);

export const knowledgeEvidence = pgTable(
  "knowledge_evidence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    kind: text("kind").notNull(),
    sourceType: text("source_type").notNull(),
    sourceId: text("source_id"),
    sourceVersionHash: text("source_version_hash"),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    confidence: numeric("confidence", { precision: 4, scale: 3 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userKindIdx: index("knowledge_evidence_user_kind_idx").on(table.userId, table.kind),
    userSourceIdx: index("knowledge_evidence_user_source_idx").on(
      table.userId,
      table.sourceType,
      table.sourceId,
    ),
    sourceVersionIdx: index("knowledge_evidence_source_version_idx").on(table.sourceVersionHash),
  }),
);

export const knowledgeEvidenceSourceLinks = pgTable(
  "knowledge_evidence_source_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    evidenceId: uuid("evidence_id")
      .references(() => knowledgeEvidence.id, { onDelete: "cascade" })
      .notNull(),
    sourceType: text("source_type").notNull(),
    sourceId: text("source_id"),
    refType: text("ref_type").notNull(),
    refId: text("ref_id").notNull(),
    snippet: text("snippet"),
    weight: numeric("weight", { precision: 5, scale: 3 }).notNull().default("1.000"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    evidenceIdx: index("knowledge_evidence_source_links_evidence_idx").on(table.evidenceId),
    refIdx: index("knowledge_evidence_source_links_ref_idx").on(table.refType, table.refId),
    uniqueEvidenceRefIdx: uniqueIndex("knowledge_evidence_source_links_unique_idx").on(
      table.evidenceId,
      table.refType,
      table.refId,
    ),
  }),
);

export const knowledgeInsights = pgTable(
  "knowledge_insights",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    confidence: numeric("confidence", { precision: 4, scale: 3 }).notNull(),
    createdByRunId: uuid("created_by_run_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userKindIdx: index("knowledge_insights_user_kind_idx").on(table.userId, table.kind),
    createdByRunIdx: index("knowledge_insights_created_by_run_idx").on(table.createdByRunId),
  }),
);

export const knowledgeInsightEvidence = pgTable(
  "knowledge_insight_evidence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    insightId: uuid("insight_id")
      .references(() => knowledgeInsights.id, { onDelete: "cascade" })
      .notNull(),
    evidenceId: uuid("evidence_id")
      .references(() => knowledgeEvidence.id, { onDelete: "cascade" })
      .notNull(),
    weight: numeric("weight", { precision: 5, scale: 3 }).notNull().default("1.000"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    uniqueInsightEvidenceIdx: uniqueIndex("knowledge_insight_evidence_unique_idx").on(
      table.insightId,
      table.evidenceId,
    ),
    evidenceIdx: index("knowledge_insight_evidence_evidence_idx").on(table.evidenceId),
  }),
);

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

export type KnowledgeEvidenceEvent = typeof knowledgeEvidenceEvents.$inferSelect;
export type NewKnowledgeEvidenceEvent = typeof knowledgeEvidenceEvents.$inferInsert;
export type KnowledgeEvidenceEventRef = typeof knowledgeEvidenceEventRefs.$inferSelect;
export type NewKnowledgeEvidenceEventRef = typeof knowledgeEvidenceEventRefs.$inferInsert;
export type KnowledgeEvidence = typeof knowledgeEvidence.$inferSelect;
export type NewKnowledgeEvidence = typeof knowledgeEvidence.$inferInsert;
export type KnowledgeEvidenceSourceLink = typeof knowledgeEvidenceSourceLinks.$inferSelect;
export type NewKnowledgeEvidenceSourceLink = typeof knowledgeEvidenceSourceLinks.$inferInsert;
export type KnowledgeInsight = typeof knowledgeInsights.$inferSelect;
export type NewKnowledgeInsight = typeof knowledgeInsights.$inferInsert;
export type KnowledgeInsightEvidence = typeof knowledgeInsightEvidence.$inferSelect;
export type NewKnowledgeInsightEvidence = typeof knowledgeInsightEvidence.$inferInsert;
export type KnowledgeChunk = typeof knowledgeChunks.$inferSelect;
export type NewKnowledgeChunk = typeof knowledgeChunks.$inferInsert;
export type NoteChunk = KnowledgeChunk;
export type NewNoteChunk = NewKnowledgeChunk;
