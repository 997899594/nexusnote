-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Workspaces table
CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL DEFAULT 'Untitled',
  workspace_id UUID REFERENCES workspaces(id),
  content BYTEA, -- Yjs binary state
  plain_text TEXT, -- For full-text search and RAG
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Document chunks table (for RAG)
-- embedding 维度通过环境变量配置，切换模型需重建表
-- 这是业界标准做法：切换 embedding 模型 = 重新索引所有文档
CREATE TABLE IF NOT EXISTS document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding vector(1024), -- 默认 1024 (BGE)，切换模型时重建
  embedding_model TEXT,   -- 记录模型名，用于检测是否需要重索引
  chunk_index INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- HNSW 索引：高效相似度搜索
CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx
  ON document_chunks
  USING hnsw (embedding vector_cosine_ops);

-- Index for document lookup
CREATE INDEX IF NOT EXISTS document_chunks_document_id_idx
  ON document_chunks(document_id);

-- Full-text search index on documents
CREATE INDEX IF NOT EXISTS documents_plain_text_idx
  ON documents
  USING gin(to_tsvector('english', plain_text));
