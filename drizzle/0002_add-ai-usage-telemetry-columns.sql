ALTER TABLE "ai_usage"
ADD COLUMN IF NOT EXISTS "request_id" text,
ADD COLUMN IF NOT EXISTS "profile" text,
ADD COLUMN IF NOT EXISTS "workflow" text,
ADD COLUMN IF NOT EXISTS "prompt_version" text,
ADD COLUMN IF NOT EXISTS "metadata" jsonb;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_usage_request_id_idx" ON "ai_usage" USING btree ("request_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_usage_profile_idx" ON "ai_usage" USING btree ("profile");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_usage_workflow_idx" ON "ai_usage" USING btree ("workflow");
