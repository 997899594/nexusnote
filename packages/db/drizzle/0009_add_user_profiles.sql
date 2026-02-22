-- Custom SQL migration file, put your code below! --

-- user_profiles 表：用户学习画像
CREATE TABLE IF NOT EXISTS "user_profiles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
  "learning_goals" jsonb,
  "knowledge_areas" jsonb,
  "learning_style" jsonb,
  "assessment_history" jsonb,
  "current_level" text,
  "total_study_minutes" integer NOT NULL DEFAULT 0,
  "profile_embedding" halfvec(4000),
  "updated_at" timestamp DEFAULT now(),
  "created_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "user_profiles_user_id_idx" ON "user_profiles"("user_id");

-- HNSW 索引用于画像向量检索
CREATE INDEX IF NOT EXISTS "user_profiles_embedding_hnsw_idx" ON "user_profiles" USING hnsw ("profile_embedding" halfvec_cosine_ops);