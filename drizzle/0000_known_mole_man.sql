CREATE TABLE "ai_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"request_id" text,
	"endpoint" text NOT NULL,
	"intent" text,
	"profile" text,
	"workflow" text,
	"provider" text,
	"model_policy" text,
	"model" text NOT NULL,
	"prompt_version" text,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"total_tokens" integer DEFAULT 0 NOT NULL,
	"cost_cents" integer DEFAULT 0 NOT NULL,
	"duration_ms" integer,
	"success" boolean DEFAULT true NOT NULL,
	"error_message" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "accounts_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"session_token" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "style_privacy_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"analysis_enabled" boolean DEFAULT false NOT NULL,
	"consent_given_at" timestamp,
	"big_five_enabled" boolean DEFAULT false NOT NULL,
	"big_five_consent_given_at" timestamp,
	"auto_delete_after_days" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "style_privacy_settings_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"learning_style" jsonb,
	"ai_preferences" jsonb,
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
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"image" text,
	"email_verified" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
CREATE TABLE "conversation_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"role" text NOT NULL,
	"message" jsonb NOT NULL,
	"text_content" text DEFAULT '' NOT NULL,
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
	"learn_course_id" uuid,
	"learn_chapter_index" integer,
	"metadata" jsonb,
	"is_archived" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"title_generated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "course_chapter_skill_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"chapter_index" integer NOT NULL,
	"skill_key" text NOT NULL,
	"source" text DEFAULT 'heuristic' NOT NULL,
	"confidence" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "course_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"current_chapter" integer DEFAULT 0 NOT NULL,
	"completed_chapters" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"completed_sections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"updated_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "course_section_annotations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_section_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"anchor" jsonb NOT NULL,
	"color" text,
	"note_content" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "course_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"outline_node_id" text NOT NULL,
	"title" text NOT NULL,
	"content_markdown" text,
	"plain_text" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "course_skill_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"skill_key" text NOT NULL,
	"source" text DEFAULT 'heuristic' NOT NULL,
	"confidence" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"difficulty" text DEFAULT 'intermediate' NOT NULL,
	"estimated_minutes" integer,
	"outline_data" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "knowledge_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_type" text DEFAULT 'note' NOT NULL,
	"source_id" uuid NOT NULL,
	"content" text NOT NULL,
	"embedding" vector(4000),
	"chunk_index" integer NOT NULL,
	"user_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "note_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"note_id" uuid,
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
CREATE TABLE "note_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"note_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"confidence" real NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"confirmed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text DEFAULT 'Untitled' NOT NULL,
	"source_type" text DEFAULT 'manual' NOT NULL,
	"source_context" jsonb,
	"content_html" text,
	"plain_text" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"name_embedding" vector(4000),
	"usage_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "tags_name_unique" UNIQUE("name")
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
CREATE TABLE "user_skill_mastery" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"skill_id" uuid NOT NULL,
	"level" integer DEFAULT 0 NOT NULL,
	"experience" integer DEFAULT 0 NOT NULL,
	"evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"confidence" integer DEFAULT 0 NOT NULL,
	"unlocked_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_skins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"avatar" text,
	"system_prompt" text NOT NULL,
	"style" text,
	"examples" jsonb DEFAULT '[]'::jsonb,
	"author_id" uuid,
	"is_built_in" boolean DEFAULT false NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"version" text DEFAULT '1.0.0',
	"usage_count" integer DEFAULT 0 NOT NULL,
	"rating" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "ai_skins_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "user_skin_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"default_skin_slug" text DEFAULT 'default' NOT NULL,
	"last_switched_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "user_skin_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "style_privacy_settings" ADD CONSTRAINT "style_privacy_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_learn_course_id_courses_id_fk" FOREIGN KEY ("learn_course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_chapter_skill_mappings" ADD CONSTRAINT "course_chapter_skill_mappings_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_progress" ADD CONSTRAINT "course_progress_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_progress" ADD CONSTRAINT "course_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_section_annotations" ADD CONSTRAINT "course_section_annotations_course_section_id_course_sections_id_fk" FOREIGN KEY ("course_section_id") REFERENCES "public"."course_sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_section_annotations" ADD CONSTRAINT "course_section_annotations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_sections" ADD CONSTRAINT "course_sections_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_skill_mappings" ADD CONSTRAINT "course_skill_mappings_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_snapshots" ADD CONSTRAINT "note_snapshots_note_id_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_tags" ADD CONSTRAINT "note_tags_note_id_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_tags" ADD CONSTRAINT "note_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_relationships" ADD CONSTRAINT "skill_relationships_source_skill_id_skills_id_fk" FOREIGN KEY ("source_skill_id") REFERENCES "public"."skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_relationships" ADD CONSTRAINT "skill_relationships_target_skill_id_skills_id_fk" FOREIGN KEY ("target_skill_id") REFERENCES "public"."skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_skill_mastery" ADD CONSTRAINT "user_skill_mastery_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_skill_mastery" ADD CONSTRAINT "user_skill_mastery_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_skins" ADD CONSTRAINT "ai_skins_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_skin_preferences" ADD CONSTRAINT "user_skin_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_usage_user_id_idx" ON "ai_usage" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ai_usage_request_id_idx" ON "ai_usage" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "ai_usage_endpoint_idx" ON "ai_usage" USING btree ("endpoint");--> statement-breakpoint
CREATE INDEX "ai_usage_profile_idx" ON "ai_usage" USING btree ("profile");--> statement-breakpoint
CREATE INDEX "ai_usage_workflow_idx" ON "ai_usage" USING btree ("workflow");--> statement-breakpoint
CREATE INDEX "ai_usage_provider_idx" ON "ai_usage" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "ai_usage_model_policy_idx" ON "ai_usage" USING btree ("model_policy");--> statement-breakpoint
CREATE INDEX "ai_usage_created_at_idx" ON "ai_usage" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "style_privacy_settings_user_id_idx" ON "style_privacy_settings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_profiles_user_id_idx" ON "user_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "conversation_messages_conversation_idx" ON "conversation_messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "conversation_messages_conversation_position_idx" ON "conversation_messages" USING btree ("conversation_id","position");--> statement-breakpoint
CREATE INDEX "conversations_user_id_idx" ON "conversations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "conversations_last_message_idx" ON "conversations" USING btree ("last_message_at");--> statement-breakpoint
CREATE UNIQUE INDEX "conversations_learn_scope_unique_idx" ON "conversations" USING btree ("user_id","intent","learn_course_id","learn_chapter_index");--> statement-breakpoint
CREATE INDEX "course_chapter_skill_mappings_course_id_idx" ON "course_chapter_skill_mappings" USING btree ("course_id","chapter_index");--> statement-breakpoint
CREATE INDEX "course_chapter_skill_mappings_skill_key_idx" ON "course_chapter_skill_mappings" USING btree ("skill_key");--> statement-breakpoint
CREATE UNIQUE INDEX "course_chapter_skill_mappings_unique_idx" ON "course_chapter_skill_mappings" USING btree ("course_id","chapter_index","skill_key");--> statement-breakpoint
CREATE UNIQUE INDEX "course_progress_course_id_unique_idx" ON "course_progress" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "course_progress_user_id_idx" ON "course_progress" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "course_section_annotations_section_id_idx" ON "course_section_annotations" USING btree ("course_section_id");--> statement-breakpoint
CREATE INDEX "course_section_annotations_user_id_idx" ON "course_section_annotations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "course_sections_course_id_idx" ON "course_sections" USING btree ("course_id");--> statement-breakpoint
CREATE UNIQUE INDEX "course_sections_course_outline_idx" ON "course_sections" USING btree ("course_id","outline_node_id");--> statement-breakpoint
CREATE INDEX "course_skill_mappings_course_id_idx" ON "course_skill_mappings" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "course_skill_mappings_skill_key_idx" ON "course_skill_mappings" USING btree ("skill_key");--> statement-breakpoint
CREATE UNIQUE INDEX "course_skill_mappings_unique_idx" ON "course_skill_mappings" USING btree ("course_id","skill_key");--> statement-breakpoint
CREATE INDEX "courses_user_id_idx" ON "courses" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "knowledge_chunks_source_idx" ON "knowledge_chunks" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE INDEX "knowledge_chunks_user_id_idx" ON "knowledge_chunks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "note_tags_note_idx" ON "note_tags" USING btree ("note_id");--> statement-breakpoint
CREATE INDEX "note_tags_tag_idx" ON "note_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "note_tags_status_idx" ON "note_tags" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "note_tags_note_tag_unique_idx" ON "note_tags" USING btree ("note_id","tag_id");--> statement-breakpoint
CREATE INDEX "notes_user_id_idx" ON "notes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notes_source_type_idx" ON "notes" USING btree ("source_type");--> statement-breakpoint
CREATE INDEX "tags_name_idx" ON "tags" USING btree ("name");--> statement-breakpoint
CREATE INDEX "skill_relationships_source_idx" ON "skill_relationships" USING btree ("source_skill_id");--> statement-breakpoint
CREATE INDEX "skill_relationships_target_idx" ON "skill_relationships" USING btree ("target_skill_id");--> statement-breakpoint
CREATE INDEX "skill_relationships_unique_idx" ON "skill_relationships" USING btree ("source_skill_id","target_skill_id","relationship_type");--> statement-breakpoint
CREATE INDEX "skills_category_idx" ON "skills" USING btree ("category");--> statement-breakpoint
CREATE INDEX "user_skill_mastery_user_idx" ON "user_skill_mastery" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_skill_mastery_skill_idx" ON "user_skill_mastery" USING btree ("skill_id");--> statement-breakpoint
CREATE INDEX "user_skill_mastery_unique_idx" ON "user_skill_mastery" USING btree ("user_id","skill_id");--> statement-breakpoint
CREATE INDEX "ai_skins_slug_idx" ON "ai_skins" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "ai_skins_author_id_idx" ON "ai_skins" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "ai_skins_is_enabled_idx" ON "ai_skins" USING btree ("is_enabled");--> statement-breakpoint
CREATE INDEX "user_skin_preferences_user_id_idx" ON "user_skin_preferences" USING btree ("user_id");