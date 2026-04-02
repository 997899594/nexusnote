CREATE INDEX IF NOT EXISTS "knowledge_chunks_content_fts_idx"
  ON "knowledge_chunks"
  USING gin (to_tsvector('simple', "content"));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notes_user_updated_at_idx"
  ON "notes" ("user_id", "updated_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conversations_user_updated_at_idx"
  ON "conversations" ("user_id", "updated_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "courses_user_updated_at_idx"
  ON "courses" ("user_id", "updated_at" DESC);
