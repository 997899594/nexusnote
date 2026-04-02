import {
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { bytea, embeddingVector } from "./shared";

export type NoteSourceContext = {
  courseId?: string;
  courseTitle?: string;
  sectionId?: string;
  sectionTitle?: string;
  chapterIndex?: number;
  selectionText?: string;
  anchor?: {
    textContent: string;
    startOffset: number;
    endOffset: number;
  };
  annotationId?: string;
  noteContent?: string;
  chatCapture?: boolean;
  source?: string;
  messageCount?: number;
  latestExcerpt?: string;
};

export const notes = pgTable(
  "notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    title: text("title").notNull().default("Untitled"),
    sourceType: text("source_type").notNull().default("manual"),
    sourceContext: jsonb("source_context").$type<NoteSourceContext>(),
    contentHtml: text("content_html"),
    plainText: text("plain_text"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    userIdIdx: index("notes_user_id_idx").on(table.userId),
    sourceTypeIdx: index("notes_source_type_idx").on(table.sourceType),
  }),
);

export const noteSnapshots = pgTable("note_snapshots", {
  id: text("id").primaryKey(),
  noteId: uuid("note_id").references(() => notes.id, {
    onDelete: "cascade",
  }),
  yjsState: bytea("yjs_state"),
  plainText: text("plain_text"),
  timestamp: timestamp("timestamp").notNull(),
  trigger: text("trigger").notNull(),
  summary: text("summary"),
  wordCount: integer("word_count"),
  diffAdded: integer("diff_added"),
  diffRemoved: integer("diff_removed"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const tags = pgTable(
  "tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull().unique(),
    nameEmbedding: embeddingVector("name_embedding"),
    usageCount: integer("usage_count").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    nameIdx: index("tags_name_idx").on(table.name),
  }),
);

export const noteTags = pgTable(
  "note_tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    noteId: uuid("note_id")
      .notNull()
      .references(() => notes.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    confidence: real("confidence").notNull(),
    status: text("status").notNull().default("pending"),
    createdAt: timestamp("created_at").defaultNow(),
    confirmedAt: timestamp("confirmed_at"),
  },
  (table) => ({
    noteIdx: index("note_tags_note_idx").on(table.noteId),
    tagIdx: index("note_tags_tag_idx").on(table.tagId),
    statusIdx: index("note_tags_status_idx").on(table.status),
    uniqueNoteTag: uniqueIndex("note_tags_note_tag_unique_idx").on(table.noteId, table.tagId),
  }),
);

export type Note = typeof notes.$inferSelect;
export type NewNote = typeof notes.$inferInsert;
export type NoteSnapshot = typeof noteSnapshots.$inferSelect;
export type NewNoteSnapshot = typeof noteSnapshots.$inferInsert;
export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
export type NoteTag = typeof noteTags.$inferSelect;
export type NewNoteTag = typeof noteTags.$inferInsert;
