-- ============================================
-- 升级 Embedding: halfvec(4000) + Qwen3-Embedding-8B
-- halfvec: 半精度向量，省 50% 存储，支持最高 4000 维度
-- 模型: Qwen3-Embedding-8B (MTEB #1, 70.58分)
-- 日期: 2026-01
-- ============================================

-- 1. 删除旧的 HNSW 索引
DROP INDEX IF EXISTS document_chunks_embedding_idx;

-- 2. 删除旧的 embedding 列
ALTER TABLE document_chunks DROP COLUMN IF EXISTS embedding;

-- 3. 添加 halfvec 列 (4000维度 - HNSW 最大支持)
ALTER TABLE document_chunks ADD COLUMN embedding halfvec(4000);

-- 4. 重建 HNSW 索引 (halfvec_cosine_ops)
CREATE INDEX document_chunks_embedding_idx
  ON document_chunks
  USING hnsw (embedding halfvec_cosine_ops);

-- 5. 清空 embedding_model 标记，触发重新索引
UPDATE document_chunks SET embedding_model = NULL WHERE embedding_model IS NOT NULL;

-- ============================================
-- 注意: 所有文档需要重新生成 embedding
-- ============================================
