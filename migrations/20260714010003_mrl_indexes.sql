-- atlas:txmode none

CREATE INDEX CONCURRENTLY IF NOT EXISTS knowledge_evidence_chunks_embedding_hnsw_idx
  ON knowledge_evidence_chunks USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX CONCURRENTLY IF NOT EXISTS tags_name_embedding_hnsw_idx
  ON tags USING hnsw (name_embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

INSERT INTO app_schema_releases (version, metadata)
VALUES (
  '2026-07-14-mrl-embeddings-v1',
  '{"dimensions":1536,"model":"Qwen/Qwen3-Embedding-8B","operatorClass":"vector_cosine_ops"}'::jsonb
)
ON CONFLICT (version) DO UPDATE SET
  metadata = EXCLUDED.metadata,
  applied_at = now();
