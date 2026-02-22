-- conversations 表：聊天会话
CREATE TABLE IF NOT EXISTS "conversations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid REFERENCES "users"("id") ON DELETE CASCADE,
  "title" text NOT NULL DEFAULT '新对话',
  "intent" text NOT NULL DEFAULT 'CHAT',
  "summary" text,
  "message_count" integer DEFAULT 0,
  "last_message_at" timestamp DEFAULT now(),
  "messages" jsonb NOT NULL DEFAULT '[]',
  "metadata" jsonb,
  "is_archived" boolean DEFAULT false,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "conversations_user_id_idx" ON "conversations"("user_id");
CREATE INDEX IF NOT EXISTS "conversations_last_message_idx" ON "conversations"("last_message_at");

-- 重命名 document_chunks 为 knowledge_chunks
ALTER TABLE IF EXISTS "document_chunks" RENAME TO "knowledge_chunks";

-- 添加 source_type 列
ALTER TABLE "knowledge_chunks" ADD COLUMN IF NOT EXISTS "source_type" text NOT NULL DEFAULT 'document';

-- 更新索引
DROP INDEX IF EXISTS "document_chunks_document_id_idx";
CREATE INDEX IF NOT EXISTS "knowledge_chunks_source_idx" ON "knowledge_chunks"("source_type", "source_id");

-- 重命名 source_id（如果原来是 document_id）
ALTER TABLE "knowledge_chunks" RENAME COLUMN "document_id" TO "source_id";
