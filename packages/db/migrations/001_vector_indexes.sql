-- 向量索引迁移：为所有 embedding 列创建 HNSW 索引
-- 解决问题：当前向量搜索是全表扫描，数据量增长后 RAG 不可用
-- HNSW 参数：m=16（每层最大连接数），ef_construction=64（构建时搜索宽度）
-- 使用 CONCURRENTLY 避免锁表

-- 文档分块嵌入索引（RAG 搜索的核心路径）
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_document_chunks_embedding
  ON document_chunks
  USING hnsw (embedding halfvec_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- 主题中心向量索引（知识分类匹配）
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_topics_embedding
  ON topics
  USING hnsw (embedding halfvec_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- 提取笔记嵌入索引（笔记归类到主题）
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_extracted_notes_embedding
  ON extracted_notes
  USING hnsw (embedding halfvec_cosine_ops)
  WITH (m = 16, ef_construction = 64);
