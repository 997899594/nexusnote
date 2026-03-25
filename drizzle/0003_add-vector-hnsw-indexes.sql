CREATE INDEX IF NOT EXISTS "knowledge_chunks_embedding_hnsw_idx"
  ON "knowledge_chunks"
  USING hnsw ("embedding" vector_cosine_ops)
  WHERE "embedding" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tags_name_embedding_hnsw_idx"
  ON "tags"
  USING hnsw ("name_embedding" vector_cosine_ops)
  WHERE "name_embedding" IS NOT NULL;
