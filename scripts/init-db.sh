#!/bin/bash
# 动态初始化数据库，支持不同的 Embedding 维度
# 用法: EMBEDDING_DIMENSION=1024 ./scripts/init-db.sh

set -e

# 默认 1024 维度 (BGE 模型)
EMBEDDING_DIMENSION=${EMBEDDING_DIMENSION:-1024}

echo "Initializing database with embedding dimension: $EMBEDDING_DIMENSION"

docker exec -i nexusnote-db psql -U postgres -d nexusnote << EOF
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
  content BYTEA,
  plain_text TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Document chunks table (for RAG) - 维度可配置
DROP TABLE IF EXISTS document_chunks CASCADE;
CREATE TABLE document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding vector($EMBEDDING_DIMENSION),
  chunk_index INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create HNSW index for fast similarity search
CREATE INDEX document_chunks_embedding_idx
  ON document_chunks
  USING hnsw (embedding vector_cosine_ops);

CREATE INDEX document_chunks_document_id_idx
  ON document_chunks(document_id);

-- Full-text search index
CREATE INDEX IF NOT EXISTS documents_plain_text_idx
  ON documents
  USING gin(to_tsvector('english', plain_text));
EOF

echo "Database initialized successfully!"
echo "Embedding dimension: $EMBEDDING_DIMENSION"
