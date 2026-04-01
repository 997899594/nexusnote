ALTER TABLE "ai_usage"
ADD COLUMN IF NOT EXISTS "provider" text,
ADD COLUMN IF NOT EXISTS "model_policy" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_usage_provider_idx" ON "ai_usage" USING btree ("provider");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_usage_model_policy_idx" ON "ai_usage" USING btree ("model_policy");
