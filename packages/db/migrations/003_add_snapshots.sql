-- Document snapshots table (for timeline feature)
CREATE TABLE IF NOT EXISTS document_snapshots (
  id TEXT PRIMARY KEY, -- format: documentId-timestamp
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  yjs_state BYTEA, -- Yjs full state
  plain_text TEXT,
  timestamp TIMESTAMPTZ NOT NULL,
  trigger TEXT NOT NULL, -- 'auto' | 'manual' | 'ai_edit' | 'collab_join' | 'restore'
  summary TEXT,
  word_count INTEGER,
  diff_added INTEGER,
  diff_removed INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient snapshot lookup by document
CREATE INDEX IF NOT EXISTS document_snapshots_document_id_idx
  ON document_snapshots(document_id);

-- Index for timestamp-based queries (timeline)
CREATE INDEX IF NOT EXISTS document_snapshots_timestamp_idx
  ON document_snapshots(document_id, timestamp DESC);
