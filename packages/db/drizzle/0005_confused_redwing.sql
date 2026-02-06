CREATE TABLE "ai_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"endpoint" text NOT NULL,
	"intent" text,
	"model" text NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"total_tokens" integer DEFAULT 0 NOT NULL,
	"cost_cents" integer DEFAULT 0 NOT NULL,
	"duration_ms" integer,
	"success" boolean DEFAULT true NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "course_chapters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid,
	"chapter_index" integer NOT NULL,
	"section_index" integer NOT NULL,
	"title" text NOT NULL,
	"content_markdown" text NOT NULL,
	"is_generated" boolean DEFAULT true,
	"generated_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "course_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"course_id" uuid NOT NULL,
	"goal" text NOT NULL,
	"background" text NOT NULL,
	"target_outcome" text NOT NULL,
	"cognitive_style" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"difficulty" text DEFAULT 'intermediate' NOT NULL,
	"estimated_minutes" integer NOT NULL,
	"outline_data" jsonb NOT NULL,
	"outline_markdown" text,
	"design_reason" text,
	"current_chapter" integer DEFAULT 1,
	"current_section" integer DEFAULT 1,
	"is_completed" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "course_profiles_course_id_unique" UNIQUE("course_id")
);
--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_chapters" ADD CONSTRAINT "course_chapters_course_id_course_profiles_course_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."course_profiles"("course_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_profiles" ADD CONSTRAINT "course_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_usage_user_id_idx" ON "ai_usage" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ai_usage_endpoint_idx" ON "ai_usage" USING btree ("endpoint");--> statement-breakpoint
CREATE INDEX "ai_usage_created_at_idx" ON "ai_usage" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "course_chapters_course_id_idx" ON "course_chapters" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "course_chapters_chapter_idx" ON "course_chapters" USING btree ("chapter_index");--> statement-breakpoint
CREATE INDEX "course_profiles_user_id_idx" ON "course_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "course_profiles_course_id_idx" ON "course_profiles" USING btree ("course_id");