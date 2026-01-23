-- 修改 embedding 列为可选的 text 类型（如果 pgvector 不可用）
-- 这个迁移会检查 pgvector 扩展是否存在，如果不存在则使用 text 类型

DO $$
BEGIN
  -- 尝试创建 pgvector 扩展
  BEGIN
    CREATE EXTENSION IF NOT EXISTS vector;
    RAISE NOTICE 'pgvector extension is available';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pgvector extension not available, will use text type for embeddings';
  END;

  -- 检查 embedding 列是否已存在
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'document_chunks' AND column_name = 'embedding'
  ) THEN
    -- 如果列已存在，尝试修改类型
    BEGIN
      -- 先尝试使用 halfvec
      ALTER TABLE document_chunks ALTER COLUMN embedding TYPE halfvec(4000) USING embedding::text::halfvec(4000);
      RAISE NOTICE 'Using halfvec type for embeddings';
    EXCEPTION WHEN OTHERS THEN
      -- 如果失败，使用 text 类型
      ALTER TABLE document_chunks ALTER COLUMN embedding TYPE text USING embedding::text;
      RAISE NOTICE 'Using text type for embeddings (pgvector not available)';
    END;
  END IF;
END $$;
