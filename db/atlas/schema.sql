
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

CREATE TABLE "sessions" (
	"session_token" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires" timestamp NOT NULL
);

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

CREATE TABLE "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);

CREATE TABLE "conversation_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"role" text NOT NULL,
	"message" jsonb NOT NULL,
	"text_content" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now()
);

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

CREATE TABLE "course_outline_nodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"outline_version_id" uuid NOT NULL,
	"node_type" text NOT NULL,
	"node_key" text NOT NULL,
	"parent_node_key" text,
	"chapter_index" integer NOT NULL,
	"section_index" integer,
	"position" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"skill_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"practice_type" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

CREATE TABLE "course_outline_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"version_hash" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"target_audience" text,
	"difficulty" text DEFAULT 'intermediate' NOT NULL,
	"learning_outcome" text,
	"course_skill_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"prerequisites" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_latest" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

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

CREATE TABLE "course_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"outline_node_key" text NOT NULL,
	"title" text NOT NULL,
	"content_markdown" text,
	"plain_text" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

CREATE TABLE "courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"difficulty" text DEFAULT 'intermediate' NOT NULL,
	"estimated_minutes" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

CREATE TABLE "knowledge_generation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"course_id" uuid,
	"kind" text NOT NULL,
	"status" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"model" text NOT NULL,
	"prompt_version" text NOT NULL,
	"input_hash" text NOT NULL,
	"output_json" jsonb,
	"error_code" text,
	"error_message" text,
	"started_at" timestamp,
	"finished_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "user_career_tree_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"selected_direction_key" text,
	"selection_count" integer DEFAULT 0 NOT NULL,
	"preference_version" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "user_career_tree_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"compose_run_id" uuid,
	"schema_version" integer NOT NULL,
	"status" text NOT NULL,
	"recommended_direction_key" text,
	"selected_direction_key" text,
	"graph_version" integer NOT NULL,
	"preference_version" integer NOT NULL,
	"payload" jsonb NOT NULL,
	"is_latest" boolean DEFAULT false NOT NULL,
	"generated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "user_focus_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"tree_snapshot_id" uuid,
	"direction_key" text,
	"node_id" text,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"state" text NOT NULL,
	"payload" jsonb NOT NULL,
	"is_latest" boolean DEFAULT false NOT NULL,
	"generated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "user_growth_state" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"graph_version" integer DEFAULT 0 NOT NULL,
	"last_merge_run_id" uuid,
	"merge_locked_at" timestamp,
	"compose_locked_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "user_profile_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"tree_snapshot_id" uuid,
	"focus_snapshot_id" uuid,
	"payload" jsonb NOT NULL,
	"is_latest" boolean DEFAULT false NOT NULL,
	"generated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "user_skill_edges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"from_node_id" uuid NOT NULL,
	"to_node_id" uuid NOT NULL,
	"confidence" numeric(4, 3) NOT NULL,
	"source_merge_run_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "user_skill_node_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"node_id" uuid NOT NULL,
	"knowledge_evidence_id" uuid NOT NULL,
	"merge_run_id" uuid,
	"weight" numeric(5, 3) DEFAULT '1.000' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "user_skill_nodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"canonical_label" text NOT NULL,
	"summary" text,
	"state" text NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"mastery_score" integer DEFAULT 0 NOT NULL,
	"evidence_score" integer DEFAULT 0 NOT NULL,
	"course_count" integer DEFAULT 0 NOT NULL,
	"chapter_count" integer DEFAULT 0 NOT NULL,
	"last_merged_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "knowledge_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"source_type" text NOT NULL,
	"source_id" text,
	"source_version_hash" text,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"confidence" numeric(4, 3) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "knowledge_evidence_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"knowledge_evidence_id" uuid NOT NULL,
	"content" text NOT NULL,
	"embedding" vector(4000),
	"chunk_index" integer NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now()
);

CREATE TABLE "knowledge_evidence_event_refs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"ref_type" text NOT NULL,
	"ref_id" text NOT NULL,
	"snippet" text,
	"weight" numeric(5, 3) DEFAULT '1.000' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "knowledge_evidence_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"source_type" text NOT NULL,
	"source_id" text,
	"source_version_hash" text,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"confidence" numeric(4, 3) NOT NULL,
	"happened_at" timestamp NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "knowledge_evidence_source_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"evidence_id" uuid NOT NULL,
	"source_type" text NOT NULL,
	"source_id" text,
	"ref_type" text NOT NULL,
	"ref_id" text NOT NULL,
	"snippet" text,
	"weight" numeric(5, 3) DEFAULT '1.000' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "knowledge_insight_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"insight_id" uuid NOT NULL,
	"evidence_id" uuid NOT NULL,
	"weight" numeric(5, 3) DEFAULT '1.000' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "knowledge_insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"confidence" numeric(4, 3) NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by_run_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

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

CREATE TABLE "note_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"note_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"confidence" real NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"confirmed_at" timestamp
);

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

CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"name_embedding" vector(4000),
	"usage_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "tags_name_unique" UNIQUE("name")
);

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

CREATE TABLE "user_skin_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"default_skin_slug" text DEFAULT 'default' NOT NULL,
	"last_switched_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "user_skin_preferences_user_id_unique" UNIQUE("user_id")
);

ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "style_privacy_settings" ADD CONSTRAINT "style_privacy_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_learn_course_id_courses_id_fk" FOREIGN KEY ("learn_course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "course_outline_nodes" ADD CONSTRAINT "course_outline_nodes_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "course_outline_nodes" ADD CONSTRAINT "course_outline_nodes_outline_version_id_course_outline_versions_id_fk" FOREIGN KEY ("outline_version_id") REFERENCES "public"."course_outline_versions"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "course_outline_versions" ADD CONSTRAINT "course_outline_versions_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "course_progress" ADD CONSTRAINT "course_progress_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "course_progress" ADD CONSTRAINT "course_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "course_section_annotations" ADD CONSTRAINT "course_section_annotations_course_section_id_course_sections_id_fk" FOREIGN KEY ("course_section_id") REFERENCES "public"."course_sections"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "course_section_annotations" ADD CONSTRAINT "course_section_annotations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "course_sections" ADD CONSTRAINT "course_sections_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "courses" ADD CONSTRAINT "courses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "knowledge_generation_runs" ADD CONSTRAINT "knowledge_generation_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "knowledge_generation_runs" ADD CONSTRAINT "knowledge_generation_runs_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "user_career_tree_preferences" ADD CONSTRAINT "user_career_tree_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "user_career_tree_snapshots" ADD CONSTRAINT "user_career_tree_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "user_career_tree_snapshots" ADD CONSTRAINT "user_career_tree_snapshots_compose_run_id_knowledge_generation_runs_id_fk" FOREIGN KEY ("compose_run_id") REFERENCES "public"."knowledge_generation_runs"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "user_focus_snapshots" ADD CONSTRAINT "user_focus_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "user_focus_snapshots" ADD CONSTRAINT "user_focus_snapshots_tree_snapshot_id_user_career_tree_snapshots_id_fk" FOREIGN KEY ("tree_snapshot_id") REFERENCES "public"."user_career_tree_snapshots"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "user_growth_state" ADD CONSTRAINT "user_growth_state_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "user_growth_state" ADD CONSTRAINT "user_growth_state_last_merge_run_id_knowledge_generation_runs_id_fk" FOREIGN KEY ("last_merge_run_id") REFERENCES "public"."knowledge_generation_runs"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "user_profile_snapshots" ADD CONSTRAINT "user_profile_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "user_profile_snapshots" ADD CONSTRAINT "user_profile_snapshots_tree_snapshot_id_user_career_tree_snapshots_id_fk" FOREIGN KEY ("tree_snapshot_id") REFERENCES "public"."user_career_tree_snapshots"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "user_profile_snapshots" ADD CONSTRAINT "user_profile_snapshots_focus_snapshot_id_user_focus_snapshots_id_fk" FOREIGN KEY ("focus_snapshot_id") REFERENCES "public"."user_focus_snapshots"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "user_skill_edges" ADD CONSTRAINT "user_skill_edges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "user_skill_edges" ADD CONSTRAINT "user_skill_edges_from_node_id_user_skill_nodes_id_fk" FOREIGN KEY ("from_node_id") REFERENCES "public"."user_skill_nodes"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "user_skill_edges" ADD CONSTRAINT "user_skill_edges_to_node_id_user_skill_nodes_id_fk" FOREIGN KEY ("to_node_id") REFERENCES "public"."user_skill_nodes"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "user_skill_edges" ADD CONSTRAINT "user_skill_edges_source_merge_run_id_knowledge_generation_runs_id_fk" FOREIGN KEY ("source_merge_run_id") REFERENCES "public"."knowledge_generation_runs"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "user_skill_node_evidence" ADD CONSTRAINT "user_skill_node_evidence_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "user_skill_node_evidence" ADD CONSTRAINT "user_skill_node_evidence_node_id_user_skill_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."user_skill_nodes"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "user_skill_node_evidence" ADD CONSTRAINT "user_skill_node_evidence_knowledge_evidence_id_knowledge_evidence_id_fk" FOREIGN KEY ("knowledge_evidence_id") REFERENCES "public"."knowledge_evidence"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "user_skill_node_evidence" ADD CONSTRAINT "user_skill_node_evidence_merge_run_id_knowledge_generation_runs_id_fk" FOREIGN KEY ("merge_run_id") REFERENCES "public"."knowledge_generation_runs"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "user_skill_nodes" ADD CONSTRAINT "user_skill_nodes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "knowledge_evidence" ADD CONSTRAINT "knowledge_evidence_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "knowledge_evidence_chunks" ADD CONSTRAINT "knowledge_evidence_chunks_knowledge_evidence_id_knowledge_evidence_id_fk" FOREIGN KEY ("knowledge_evidence_id") REFERENCES "public"."knowledge_evidence"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "knowledge_evidence_event_refs" ADD CONSTRAINT "knowledge_evidence_event_refs_event_id_knowledge_evidence_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."knowledge_evidence_events"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "knowledge_evidence_events" ADD CONSTRAINT "knowledge_evidence_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "knowledge_evidence_source_links" ADD CONSTRAINT "knowledge_evidence_source_links_evidence_id_knowledge_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."knowledge_evidence"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "knowledge_insight_evidence" ADD CONSTRAINT "knowledge_insight_evidence_insight_id_knowledge_insights_id_fk" FOREIGN KEY ("insight_id") REFERENCES "public"."knowledge_insights"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "knowledge_insight_evidence" ADD CONSTRAINT "knowledge_insight_evidence_evidence_id_knowledge_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."knowledge_evidence"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "knowledge_insights" ADD CONSTRAINT "knowledge_insights_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "note_snapshots" ADD CONSTRAINT "note_snapshots_note_id_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "note_tags" ADD CONSTRAINT "note_tags_note_id_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "note_tags" ADD CONSTRAINT "note_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "notes" ADD CONSTRAINT "notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "ai_skins" ADD CONSTRAINT "ai_skins_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "user_skin_preferences" ADD CONSTRAINT "user_skin_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "ai_usage_user_id_idx" ON "ai_usage" USING btree ("user_id");
CREATE INDEX "ai_usage_request_id_idx" ON "ai_usage" USING btree ("request_id");
CREATE INDEX "ai_usage_endpoint_idx" ON "ai_usage" USING btree ("endpoint");
CREATE INDEX "ai_usage_profile_idx" ON "ai_usage" USING btree ("profile");
CREATE INDEX "ai_usage_workflow_idx" ON "ai_usage" USING btree ("workflow");
CREATE INDEX "ai_usage_provider_idx" ON "ai_usage" USING btree ("provider");
CREATE INDEX "ai_usage_model_policy_idx" ON "ai_usage" USING btree ("model_policy");
CREATE INDEX "ai_usage_created_at_idx" ON "ai_usage" USING btree ("created_at");
CREATE INDEX "style_privacy_settings_user_id_idx" ON "style_privacy_settings" USING btree ("user_id");
CREATE INDEX "user_profiles_user_id_idx" ON "user_profiles" USING btree ("user_id");
CREATE INDEX "conversation_messages_conversation_idx" ON "conversation_messages" USING btree ("conversation_id");
CREATE UNIQUE INDEX "conversation_messages_conversation_position_idx" ON "conversation_messages" USING btree ("conversation_id","position");
CREATE INDEX "conversations_user_id_idx" ON "conversations" USING btree ("user_id");
CREATE INDEX "conversations_last_message_idx" ON "conversations" USING btree ("last_message_at");
CREATE UNIQUE INDEX "conversations_learn_scope_unique_idx" ON "conversations" USING btree ("user_id","intent","learn_course_id","learn_chapter_index");
CREATE UNIQUE INDEX "course_outline_nodes_outline_node_unique_idx" ON "course_outline_nodes" USING btree ("outline_version_id","node_key");
CREATE INDEX "course_outline_nodes_course_version_idx" ON "course_outline_nodes" USING btree ("course_id","outline_version_id");
CREATE INDEX "course_outline_nodes_course_type_idx" ON "course_outline_nodes" USING btree ("course_id","node_type");
CREATE INDEX "course_outline_versions_course_latest_idx" ON "course_outline_versions" USING btree ("course_id","is_latest");
CREATE UNIQUE INDEX "course_outline_versions_course_hash_unique_idx" ON "course_outline_versions" USING btree ("course_id","version_hash");
CREATE UNIQUE INDEX "course_progress_course_id_unique_idx" ON "course_progress" USING btree ("course_id");
CREATE INDEX "course_progress_user_id_idx" ON "course_progress" USING btree ("user_id");
CREATE INDEX "course_section_annotations_section_id_idx" ON "course_section_annotations" USING btree ("course_section_id");
CREATE INDEX "course_section_annotations_user_id_idx" ON "course_section_annotations" USING btree ("user_id");
CREATE INDEX "course_sections_course_id_idx" ON "course_sections" USING btree ("course_id");
CREATE UNIQUE INDEX "course_sections_course_outline_idx" ON "course_sections" USING btree ("course_id","outline_node_key");
CREATE INDEX "courses_user_id_idx" ON "courses" USING btree ("user_id");
CREATE UNIQUE INDEX "knowledge_generation_runs_idempotency_key_unique_idx" ON "knowledge_generation_runs" USING btree ("idempotency_key");
CREATE INDEX "knowledge_generation_runs_user_kind_idx" ON "knowledge_generation_runs" USING btree ("user_id","kind");
CREATE INDEX "knowledge_generation_runs_course_idx" ON "knowledge_generation_runs" USING btree ("course_id");
CREATE INDEX "user_career_tree_preferences_selected_direction_idx" ON "user_career_tree_preferences" USING btree ("selected_direction_key");
CREATE INDEX "user_career_tree_snapshots_user_latest_idx" ON "user_career_tree_snapshots" USING btree ("user_id","is_latest");
CREATE INDEX "user_career_tree_snapshots_user_created_idx" ON "user_career_tree_snapshots" USING btree ("user_id","created_at");
CREATE INDEX "user_focus_snapshots_user_latest_idx" ON "user_focus_snapshots" USING btree ("user_id","is_latest");
CREATE INDEX "user_profile_snapshots_user_latest_idx" ON "user_profile_snapshots" USING btree ("user_id","is_latest");
CREATE INDEX "user_skill_edges_user_idx" ON "user_skill_edges" USING btree ("user_id");
CREATE UNIQUE INDEX "user_skill_edges_unique_idx" ON "user_skill_edges" USING btree ("user_id","from_node_id","to_node_id");
CREATE UNIQUE INDEX "user_skill_node_evidence_unique_idx" ON "user_skill_node_evidence" USING btree ("node_id","knowledge_evidence_id");
CREATE INDEX "user_skill_node_evidence_user_node_idx" ON "user_skill_node_evidence" USING btree ("user_id","node_id");
CREATE INDEX "user_skill_nodes_user_idx" ON "user_skill_nodes" USING btree ("user_id");
CREATE INDEX "user_skill_nodes_user_canonical_idx" ON "user_skill_nodes" USING btree ("user_id","canonical_label");
CREATE INDEX "knowledge_evidence_user_kind_idx" ON "knowledge_evidence" USING btree ("user_id","kind");
CREATE INDEX "knowledge_evidence_user_source_idx" ON "knowledge_evidence" USING btree ("user_id","source_type","source_id");
CREATE INDEX "knowledge_evidence_source_version_idx" ON "knowledge_evidence" USING btree ("source_version_hash");
CREATE INDEX "knowledge_evidence_chunks_evidence_idx" ON "knowledge_evidence_chunks" USING btree ("knowledge_evidence_id");
CREATE UNIQUE INDEX "knowledge_evidence_chunks_evidence_chunk_unique_idx" ON "knowledge_evidence_chunks" USING btree ("knowledge_evidence_id","chunk_index");
CREATE INDEX "knowledge_evidence_event_refs_event_idx" ON "knowledge_evidence_event_refs" USING btree ("event_id");
CREATE INDEX "knowledge_evidence_event_refs_ref_idx" ON "knowledge_evidence_event_refs" USING btree ("ref_type","ref_id");
CREATE UNIQUE INDEX "knowledge_evidence_event_refs_unique_idx" ON "knowledge_evidence_event_refs" USING btree ("event_id","ref_type","ref_id");
CREATE INDEX "knowledge_evidence_events_user_kind_idx" ON "knowledge_evidence_events" USING btree ("user_id","kind");
CREATE INDEX "knowledge_evidence_events_user_source_idx" ON "knowledge_evidence_events" USING btree ("user_id","source_type","source_id");
CREATE INDEX "knowledge_evidence_events_source_version_idx" ON "knowledge_evidence_events" USING btree ("source_version_hash");
CREATE INDEX "knowledge_evidence_events_happened_at_idx" ON "knowledge_evidence_events" USING btree ("happened_at");
CREATE INDEX "knowledge_evidence_source_links_evidence_idx" ON "knowledge_evidence_source_links" USING btree ("evidence_id");
CREATE INDEX "knowledge_evidence_source_links_ref_idx" ON "knowledge_evidence_source_links" USING btree ("ref_type","ref_id");
CREATE UNIQUE INDEX "knowledge_evidence_source_links_unique_idx" ON "knowledge_evidence_source_links" USING btree ("evidence_id","ref_type","ref_id");
CREATE UNIQUE INDEX "knowledge_insight_evidence_unique_idx" ON "knowledge_insight_evidence" USING btree ("insight_id","evidence_id");
CREATE INDEX "knowledge_insight_evidence_evidence_idx" ON "knowledge_insight_evidence" USING btree ("evidence_id");
CREATE INDEX "knowledge_insights_user_kind_idx" ON "knowledge_insights" USING btree ("user_id","kind");
CREATE INDEX "knowledge_insights_created_by_run_idx" ON "knowledge_insights" USING btree ("created_by_run_id");
CREATE INDEX "note_tags_note_idx" ON "note_tags" USING btree ("note_id");
CREATE INDEX "note_tags_tag_idx" ON "note_tags" USING btree ("tag_id");
CREATE INDEX "note_tags_status_idx" ON "note_tags" USING btree ("status");
CREATE UNIQUE INDEX "note_tags_note_tag_unique_idx" ON "note_tags" USING btree ("note_id","tag_id");
CREATE INDEX "notes_user_id_idx" ON "notes" USING btree ("user_id");
CREATE INDEX "notes_source_type_idx" ON "notes" USING btree ("source_type");
CREATE INDEX "tags_name_idx" ON "tags" USING btree ("name");
CREATE INDEX "ai_skins_slug_idx" ON "ai_skins" USING btree ("slug");
CREATE INDEX "ai_skins_author_id_idx" ON "ai_skins" USING btree ("author_id");
CREATE INDEX "ai_skins_is_enabled_idx" ON "ai_skins" USING btree ("is_enabled");
CREATE INDEX "user_skin_preferences_user_id_idx" ON "user_skin_preferences" USING btree ("user_id");
