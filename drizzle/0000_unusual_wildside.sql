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
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"title" text DEFAULT '新对话' NOT NULL,
	"intent" text DEFAULT 'CHAT' NOT NULL,
	"summary" text,
	"message_count" integer DEFAULT 0,
	"last_message_at" timestamp DEFAULT now(),
	"messages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metadata" jsonb,
	"is_archived" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "course_chapters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid,
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
	"title" text,
	"description" text,
	"difficulty" text DEFAULT 'intermediate',
	"estimated_minutes" integer,
	"outline_data" jsonb,
	"outline_markdown" text,
	"design_reason" text,
	"interview_profile" jsonb,
	"interview_messages" jsonb,
	"interview_status" text DEFAULT 'interviewing',
	"status" text DEFAULT 'idle',
	"current_step" jsonb,
	"current_chapter" integer DEFAULT 0,
	"current_section" integer DEFAULT 1,
	"is_completed" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "knowledge_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_type" text DEFAULT 'document' NOT NULL,
	"source_id" uuid NOT NULL,
	"content" text NOT NULL,
	"embedding" "halfvec(4000)",
	"chunk_index" integer NOT NULL,
	"user_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "document_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" uuid,
	"yjs_state" "bytea",
	"plain_text" text,
	"timestamp" timestamp NOT NULL,
	"trigger" text NOT NULL,
	"summary" text,
	"word_count" integer,
	"diff_added" integer,
	"diff_removed" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text DEFAULT 'Untitled' NOT NULL,
	"workspace_id" uuid,
	"content" "bytea",
	"plain_text" text,
	"is_vault" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "extracted_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"content" text NOT NULL,
	"embedding" "halfvec(4000)",
	"source_type" text NOT NULL,
	"source_document_id" uuid,
	"source_chapter_id" uuid,
	"source_position" jsonb,
	"topic_id" uuid,
	"status" text DEFAULT 'processing',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "flashcards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"highlight_id" uuid,
	"document_id" uuid,
	"front" text NOT NULL,
	"back" text NOT NULL,
	"context" text,
	"tags" jsonb,
	"state" integer DEFAULT 0 NOT NULL,
	"due" timestamp DEFAULT now() NOT NULL,
	"stability" integer DEFAULT 0 NOT NULL,
	"difficulty" integer DEFAULT 50 NOT NULL,
	"elapsed_days" integer DEFAULT 0 NOT NULL,
	"scheduled_days" integer DEFAULT 0 NOT NULL,
	"reps" integer DEFAULT 0 NOT NULL,
	"lapses" integer DEFAULT 0 NOT NULL,
	"suspended" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "learning_chapters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_id" uuid,
	"document_id" uuid,
	"chapter_index" integer NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"key_points" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "learning_contents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"type" text DEFAULT 'book' NOT NULL,
	"author" text,
	"cover_url" text,
	"source_url" text,
	"total_chapters" integer DEFAULT 1,
	"difficulty" text DEFAULT 'intermediate',
	"estimated_minutes" integer,
	"tags" jsonb,
	"summary" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "learning_highlights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chapter_id" uuid,
	"content" text NOT NULL,
	"note" text,
	"color" text DEFAULT 'yellow',
	"position" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "learning_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_id" uuid,
	"current_chapter" integer DEFAULT 0,
	"completed_chapters" jsonb,
	"total_time_spent" integer DEFAULT 0,
	"last_accessed_at" timestamp DEFAULT now(),
	"started_at" timestamp DEFAULT now(),
	"completed_at" timestamp,
	"mastery_level" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "review_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"flashcard_id" uuid,
	"rating" integer NOT NULL,
	"state" integer NOT NULL,
	"due" timestamp NOT NULL,
	"stability" integer NOT NULL,
	"difficulty" integer NOT NULL,
	"elapsed_days" integer NOT NULL,
	"scheduled_days" integer NOT NULL,
	"review_duration" integer,
	"reviewed_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "skill_relationships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_skill_id" uuid NOT NULL,
	"target_skill_id" uuid NOT NULL,
	"relationship_type" text NOT NULL,
	"strength" integer DEFAULT 50 NOT NULL,
	"confidence" integer DEFAULT 50 NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"category" text,
	"domain" text,
	"description" text,
	"icon" text,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "skills_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"name" text NOT NULL,
	"embedding" "halfvec(4000)",
	"note_count" integer DEFAULT 0,
	"last_active_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"learning_style" jsonb,
	"vocabulary_complexity" jsonb,
	"sentence_complexity" jsonb,
	"abstraction_level" jsonb,
	"directness" jsonb,
	"conciseness" jsonb,
	"formality" jsonb,
	"emotional_intensity" jsonb,
	"openness" jsonb,
	"conscientiousness" jsonb,
	"extraversion" jsonb,
	"agreeableness" jsonb,
	"neuroticism" jsonb,
	"total_messages_analyzed" integer DEFAULT 0 NOT NULL,
	"total_conversations_analyzed" integer DEFAULT 0 NOT NULL,
	"last_analyzed_at" timestamp,
	"updated_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "user_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "user_skill_mastery" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"skill_id" uuid NOT NULL,
	"level" integer DEFAULT 0 NOT NULL,
	"experience" integer DEFAULT 0 NOT NULL,
	"evidence" jsonb DEFAULT '[]' NOT NULL,
	"confidence" integer DEFAULT 0 NOT NULL,
	"unlocked_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"avatar_url" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"owner_id" uuid,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_chapters" ADD CONSTRAINT "course_chapters_profile_id_course_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."course_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_profiles" ADD CONSTRAINT "course_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_snapshots" ADD CONSTRAINT "document_snapshots_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extracted_notes" ADD CONSTRAINT "extracted_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extracted_notes" ADD CONSTRAINT "extracted_notes_source_document_id_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extracted_notes" ADD CONSTRAINT "extracted_notes_source_chapter_id_learning_chapters_id_fk" FOREIGN KEY ("source_chapter_id") REFERENCES "public"."learning_chapters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extracted_notes" ADD CONSTRAINT "extracted_notes_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flashcards" ADD CONSTRAINT "flashcards_highlight_id_learning_highlights_id_fk" FOREIGN KEY ("highlight_id") REFERENCES "public"."learning_highlights"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flashcards" ADD CONSTRAINT "flashcards_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_chapters" ADD CONSTRAINT "learning_chapters_content_id_learning_contents_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."learning_contents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_chapters" ADD CONSTRAINT "learning_chapters_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_highlights" ADD CONSTRAINT "learning_highlights_chapter_id_learning_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."learning_chapters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_progress" ADD CONSTRAINT "learning_progress_content_id_learning_contents_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."learning_contents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_logs" ADD CONSTRAINT "review_logs_flashcard_id_flashcards_id_fk" FOREIGN KEY ("flashcard_id") REFERENCES "public"."flashcards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_relationships" ADD CONSTRAINT "skill_relationships_source_skill_id_skills_id_fk" FOREIGN KEY ("source_skill_id") REFERENCES "public"."skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_relationships" ADD CONSTRAINT "skill_relationships_target_skill_id_skills_id_fk" FOREIGN KEY ("target_skill_id") REFERENCES "public"."skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topics" ADD CONSTRAINT "topics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_skill_mastery" ADD CONSTRAINT "user_skill_mastery_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_skill_mastery" ADD CONSTRAINT "user_skill_mastery_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_usage_user_id_idx" ON "ai_usage" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ai_usage_endpoint_idx" ON "ai_usage" USING btree ("endpoint");--> statement-breakpoint
CREATE INDEX "ai_usage_created_at_idx" ON "ai_usage" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "conversations_user_id_idx" ON "conversations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "conversations_last_message_idx" ON "conversations" USING btree ("last_message_at");--> statement-breakpoint
CREATE INDEX "course_chapters_profile_id_idx" ON "course_chapters" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "course_chapters_chapter_idx" ON "course_chapters" USING btree ("chapter_index");--> statement-breakpoint
CREATE INDEX "course_profiles_user_id_idx" ON "course_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "knowledge_chunks_source_idx" ON "knowledge_chunks" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE INDEX "knowledge_chunks_user_id_idx" ON "knowledge_chunks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "extracted_notes_topic_id_idx" ON "extracted_notes" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "extracted_notes_status_idx" ON "extracted_notes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "extracted_notes_user_id_idx" ON "extracted_notes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "flashcards_due_idx" ON "flashcards" USING btree ("due");--> statement-breakpoint
CREATE INDEX "flashcards_state_idx" ON "flashcards" USING btree ("state");--> statement-breakpoint
CREATE INDEX "skill_relationships_source_idx" ON "skill_relationships" USING btree ("source_skill_id");--> statement-breakpoint
CREATE INDEX "skill_relationships_target_idx" ON "skill_relationships" USING btree ("target_skill_id");--> statement-breakpoint
CREATE INDEX "skill_relationships_unique_idx" ON "skill_relationships" USING btree ("source_skill_id","target_skill_id","relationship_type");--> statement-breakpoint
CREATE INDEX "skills_category_idx" ON "skills" USING btree ("category");--> statement-breakpoint
CREATE INDEX "topics_user_id_idx" ON "topics" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_profiles_user_id_idx" ON "user_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_skill_mastery_user_idx" ON "user_skill_mastery" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_skill_mastery_skill_idx" ON "user_skill_mastery" USING btree ("skill_id");--> statement-breakpoint
CREATE INDEX "user_skill_mastery_unique_idx" ON "user_skill_mastery" USING btree ("user_id","skill_id");