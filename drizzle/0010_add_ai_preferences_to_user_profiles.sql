ALTER TABLE "user_profiles"
ADD COLUMN IF NOT EXISTS "ai_preferences" jsonb;
