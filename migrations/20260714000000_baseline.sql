CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE "ai_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"request_id" text,
	"endpoint" text NOT NULL,
	"intent" text,
	"capability_mode" text,
	"workflow" text,
	"model_series" text,
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

CREATE TABLE "user_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"learning_style" jsonb,
	"ai_preferences" jsonb,
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
	"first_used_at" timestamp,
	"last_used_at" timestamp,
	"use_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);

CREATE TABLE "billing_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_order_id" text,
	"provider_checkout_url" text,
	"plan" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'CNY' NOT NULL,
	"entitlement_days" integer NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"paid_at" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "billing_webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"event_id" text NOT NULL,
	"signature" text,
	"payload" jsonb NOT NULL,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "redeem_code_redemptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"entitlement_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "redeem_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code_hash" text NOT NULL,
	"plan" text NOT NULL,
	"entitlement_days" integer NOT NULL,
	"max_redemptions" integer DEFAULT 1 NOT NULL,
	"redeemed_count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp,
	"disabled_at" timestamp,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "redeem_codes_code_hash_unique" UNIQUE("code_hash")
);

CREATE TABLE "user_entitlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"plan" text NOT NULL,
	"source" text NOT NULL,
	"source_ref_id" text NOT NULL,
	"starts_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"revoked_at" timestamp,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "career_plan_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"revision_index" integer NOT NULL,
	"source" text NOT NULL,
	"selected_route_key" text,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"source_snapshot_json" jsonb,
	"signals_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"routes_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"constraints_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"map_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "career_planning_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"conversation_id" uuid,
	"status" text DEFAULT 'active' NOT NULL,
	"selected_route_key" text,
	"source_snapshot_json" jsonb,
	"signals_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "career_course_chapter_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"chapter_key" text NOT NULL,
	"chapter_index" integer NOT NULL,
	"chapter_title" text NOT NULL,
	"skill_evidence_ids" uuid[] DEFAULT ARRAY[]::uuid[] NOT NULL,
	"confidence" numeric(4, 3) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "career_course_skill_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"extract_run_id" uuid NOT NULL,
	"title" text NOT NULL,
	"kind" text NOT NULL,
	"summary" text NOT NULL,
	"confidence" numeric(4, 3) NOT NULL,
	"chapter_refs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"prerequisite_hints" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"related_hints" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"evidence_snippets" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source_outline_hash" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "career_generation_runs" (
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

CREATE TABLE "career_user_graph_state" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"graph_version" integer DEFAULT 0 NOT NULL,
	"last_merge_run_id" uuid,
	"merge_locked_at" timestamp,
	"compose_locked_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "career_user_skill_edges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"from_node_id" uuid NOT NULL,
	"to_node_id" uuid NOT NULL,
	"edge_type" text NOT NULL,
	"confidence" numeric(4, 3) NOT NULL,
	"source_merge_run_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "career_user_skill_node_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"node_id" uuid NOT NULL,
	"course_skill_evidence_id" uuid NOT NULL,
	"merge_run_id" uuid,
	"weight" numeric(5, 3) DEFAULT '1.000' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "career_user_skill_nodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"canonical_label" text NOT NULL,
	"display_hint" text,
	"summary" text,
	"kind" text NOT NULL,
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

CREATE TABLE "career_user_tree_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"selected_direction_key" text,
	"selection_count" integer DEFAULT 0 NOT NULL,
	"preference_version" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "career_user_tree_snapshots" (
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
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

CREATE TABLE "course_public_annotations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"publication_id" uuid NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"section_key" text NOT NULL,
	"user_id" uuid NOT NULL,
	"anchor" jsonb NOT NULL,
	"quoted_text" text NOT NULL,
	"body" text NOT NULL,
	"status" text DEFAULT 'visible' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "course_publication_likes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"publication_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "course_publication_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"publication_id" uuid NOT NULL,
	"source_course_id" uuid NOT NULL,
	"source_outline_version_id" uuid NOT NULL,
	"snapshot_hash" text NOT NULL,
	"content_json" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "course_publication_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"publication_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"last_seen_snapshot_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "course_publication_urges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"publication_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "course_publications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_course_id" uuid NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"current_snapshot_id" uuid,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'published' NOT NULL,
	"allow_annotations" boolean DEFAULT true NOT NULL,
	"published_at" timestamp DEFAULT now(),
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "course_outline_nodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"semantic_id" uuid DEFAULT gen_random_uuid() NOT NULL,
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
	"research_citations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_latest" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
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
	"outline_version_id" uuid NOT NULL,
	"outline_node_id" uuid NOT NULL,
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
	"content_search_text" text DEFAULT '' NOT NULL,
	"embedding" vector(1536),
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

CREATE TABLE "app_schema_releases" (
	"version" text PRIMARY KEY NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"applied_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "domain_outbox_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"topic" text NOT NULL,
	"aggregate_type" text NOT NULL,
	"aggregate_id" uuid NOT NULL,
	"payload" jsonb NOT NULL,
	"available_at" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "learning_enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"source_type" text NOT NULL,
	"course_id" uuid NOT NULL,
	"outline_version_id" uuid,
	"publication_id" uuid,
	"snapshot_id" uuid,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "learning_enrollments_source_shape_check" CHECK ((
        ("learning_enrollments"."source_type" = 'course_revision' and "learning_enrollments"."outline_version_id" is not null and "learning_enrollments"."publication_id" is null and "learning_enrollments"."snapshot_id" is null)
        or
        ("learning_enrollments"."source_type" = 'publication_snapshot' and "learning_enrollments"."outline_version_id" is null and "learning_enrollments"."publication_id" is not null and "learning_enrollments"."snapshot_id" is not null)
      ))
);

CREATE TABLE "learning_section_completions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"section_id" uuid NOT NULL,
	"completed_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "runtime_heartbeats" (
	"runtime_name" text PRIMARY KEY NOT NULL,
	"instance_id" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "learning_activity_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"enrollment_id" uuid,
	"event_type" text NOT NULL,
	"section_node_id" text,
	"idempotency_key" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
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
	"idempotency_key" text,
	"source_context" jsonb,
	"content_html" text,
	"plain_text" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"name_embedding" vector(1536),
	"usage_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "tags_name_unique" UNIQUE("name")
);

CREATE TABLE "research_run_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"task_id" uuid,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"domain" text NOT NULL,
	"snippet" text NOT NULL,
	"provider" text DEFAULT 'unknown' NOT NULL,
	"source_type" text DEFAULT 'unknown' NOT NULL,
	"quality_tier" text DEFAULT 'standard' NOT NULL,
	"quality_score" integer DEFAULT 0 NOT NULL,
	"relevance_score" integer DEFAULT 0 NOT NULL,
	"citation_id" text,
	"published_at" text,
	"extracted_at" text,
	"extract_provider" text,
	"extraction_status" text DEFAULT 'snippet_only' NOT NULL,
	"freshness_window_days" integer DEFAULT 90 NOT NULL,
	"search_query" text,
	"content_preview" text,
	"evidence_chunks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"rank" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "research_run_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"task_key" text NOT NULL,
	"ordinal" integer NOT NULL,
	"title" text NOT NULL,
	"query" text NOT NULL,
	"focus" text NOT NULL,
	"status" text NOT NULL,
	"summary" text,
	"findings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"evidence_gaps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"error_message" text,
	"started_at" timestamp,
	"finished_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "research_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"session_id" uuid,
	"job_type" text NOT NULL,
	"status" text NOT NULL,
	"model_series" text,
	"worker_transport" text DEFAULT 'local' NOT NULL,
	"user_prompt" text NOT NULL,
	"input_hash" text NOT NULL,
	"queue_job_id" text,
	"retry_of_run_id" uuid,
	"progress_json" jsonb,
	"plan_json" jsonb,
	"report_json" jsonb,
	"error_code" text,
	"error_message" text,
	"cancel_requested_at" timestamp,
	"started_at" timestamp,
	"finished_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
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
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "billing_orders" ADD CONSTRAINT "billing_orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "redeem_code_redemptions" ADD CONSTRAINT "redeem_code_redemptions_code_id_redeem_codes_id_fk" FOREIGN KEY ("code_id") REFERENCES "public"."redeem_codes"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "redeem_code_redemptions" ADD CONSTRAINT "redeem_code_redemptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "redeem_code_redemptions" ADD CONSTRAINT "redeem_code_redemptions_entitlement_id_user_entitlements_id_fk" FOREIGN KEY ("entitlement_id") REFERENCES "public"."user_entitlements"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "user_entitlements" ADD CONSTRAINT "user_entitlements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "career_plan_revisions" ADD CONSTRAINT "career_plan_revisions_session_id_career_planning_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."career_planning_sessions"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "career_plan_revisions" ADD CONSTRAINT "career_plan_revisions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "career_planning_sessions" ADD CONSTRAINT "career_planning_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "career_planning_sessions" ADD CONSTRAINT "career_planning_sessions_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "career_course_chapter_evidence" ADD CONSTRAINT "career_course_chapter_evidence_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "career_course_chapter_evidence" ADD CONSTRAINT "career_course_chapter_evidence_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "career_course_skill_evidence" ADD CONSTRAINT "career_course_skill_evidence_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "career_course_skill_evidence" ADD CONSTRAINT "career_course_skill_evidence_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "career_course_skill_evidence" ADD CONSTRAINT "career_course_skill_evidence_extract_run_id_career_generation_runs_id_fk" FOREIGN KEY ("extract_run_id") REFERENCES "public"."career_generation_runs"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "career_generation_runs" ADD CONSTRAINT "career_generation_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "career_generation_runs" ADD CONSTRAINT "career_generation_runs_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "career_user_graph_state" ADD CONSTRAINT "career_user_graph_state_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "career_user_graph_state" ADD CONSTRAINT "career_user_graph_state_last_merge_run_id_career_generation_runs_id_fk" FOREIGN KEY ("last_merge_run_id") REFERENCES "public"."career_generation_runs"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "career_user_skill_edges" ADD CONSTRAINT "career_user_skill_edges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "career_user_skill_edges" ADD CONSTRAINT "career_user_skill_edges_from_node_id_career_user_skill_nodes_id_fk" FOREIGN KEY ("from_node_id") REFERENCES "public"."career_user_skill_nodes"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "career_user_skill_edges" ADD CONSTRAINT "career_user_skill_edges_to_node_id_career_user_skill_nodes_id_fk" FOREIGN KEY ("to_node_id") REFERENCES "public"."career_user_skill_nodes"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "career_user_skill_edges" ADD CONSTRAINT "career_user_skill_edges_source_merge_run_id_career_generation_runs_id_fk" FOREIGN KEY ("source_merge_run_id") REFERENCES "public"."career_generation_runs"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "career_user_skill_node_evidence" ADD CONSTRAINT "career_user_skill_node_evidence_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "career_user_skill_node_evidence" ADD CONSTRAINT "career_user_skill_node_evidence_node_id_career_user_skill_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."career_user_skill_nodes"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "career_user_skill_node_evidence" ADD CONSTRAINT "career_user_skill_node_evidence_course_skill_evidence_id_career_course_skill_evidence_id_fk" FOREIGN KEY ("course_skill_evidence_id") REFERENCES "public"."career_course_skill_evidence"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "career_user_skill_node_evidence" ADD CONSTRAINT "career_user_skill_node_evidence_merge_run_id_career_generation_runs_id_fk" FOREIGN KEY ("merge_run_id") REFERENCES "public"."career_generation_runs"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "career_user_skill_nodes" ADD CONSTRAINT "career_user_skill_nodes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "career_user_tree_preferences" ADD CONSTRAINT "career_user_tree_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "career_user_tree_snapshots" ADD CONSTRAINT "career_user_tree_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "career_user_tree_snapshots" ADD CONSTRAINT "career_user_tree_snapshots_compose_run_id_career_generation_runs_id_fk" FOREIGN KEY ("compose_run_id") REFERENCES "public"."career_generation_runs"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_learn_course_id_courses_id_fk" FOREIGN KEY ("learn_course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "course_public_annotations" ADD CONSTRAINT "course_public_annotations_publication_id_course_publications_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."course_publications"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "course_public_annotations" ADD CONSTRAINT "course_public_annotations_snapshot_id_course_publication_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."course_publication_snapshots"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "course_public_annotations" ADD CONSTRAINT "course_public_annotations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "course_publication_likes" ADD CONSTRAINT "course_publication_likes_publication_id_course_publications_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."course_publications"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "course_publication_likes" ADD CONSTRAINT "course_publication_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "course_publication_snapshots" ADD CONSTRAINT "course_publication_snapshots_publication_id_course_publications_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."course_publications"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "course_publication_snapshots" ADD CONSTRAINT "course_publication_snapshots_source_course_id_courses_id_fk" FOREIGN KEY ("source_course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "course_publication_snapshots" ADD CONSTRAINT "course_publication_snapshots_source_outline_version_id_course_outline_versions_id_fk" FOREIGN KEY ("source_outline_version_id") REFERENCES "public"."course_outline_versions"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "course_publication_subscriptions" ADD CONSTRAINT "course_publication_subscriptions_publication_id_course_publications_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."course_publications"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "course_publication_subscriptions" ADD CONSTRAINT "course_publication_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "course_publication_subscriptions" ADD CONSTRAINT "course_publication_subscriptions_last_seen_snapshot_id_course_publication_snapshots_id_fk" FOREIGN KEY ("last_seen_snapshot_id") REFERENCES "public"."course_publication_snapshots"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "course_publication_urges" ADD CONSTRAINT "course_publication_urges_publication_id_course_publications_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."course_publications"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "course_publication_urges" ADD CONSTRAINT "course_publication_urges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "course_publications" ADD CONSTRAINT "course_publications_source_course_id_courses_id_fk" FOREIGN KEY ("source_course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "course_publications" ADD CONSTRAINT "course_publications_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "course_outline_nodes" ADD CONSTRAINT "course_outline_nodes_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "course_outline_nodes" ADD CONSTRAINT "course_outline_nodes_outline_version_id_course_outline_versions_id_fk" FOREIGN KEY ("outline_version_id") REFERENCES "public"."course_outline_versions"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "course_outline_versions" ADD CONSTRAINT "course_outline_versions_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "course_section_annotations" ADD CONSTRAINT "course_section_annotations_course_section_id_course_sections_id_fk" FOREIGN KEY ("course_section_id") REFERENCES "public"."course_sections"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "course_section_annotations" ADD CONSTRAINT "course_section_annotations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "course_sections" ADD CONSTRAINT "course_sections_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "course_sections" ADD CONSTRAINT "course_sections_outline_version_id_course_outline_versions_id_fk" FOREIGN KEY ("outline_version_id") REFERENCES "public"."course_outline_versions"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "course_sections" ADD CONSTRAINT "course_sections_outline_node_id_course_outline_nodes_id_fk" FOREIGN KEY ("outline_node_id") REFERENCES "public"."course_outline_nodes"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "courses" ADD CONSTRAINT "courses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "knowledge_evidence" ADD CONSTRAINT "knowledge_evidence_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "knowledge_evidence_chunks" ADD CONSTRAINT "knowledge_evidence_chunks_knowledge_evidence_id_knowledge_evidence_id_fk" FOREIGN KEY ("knowledge_evidence_id") REFERENCES "public"."knowledge_evidence"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "knowledge_evidence_event_refs" ADD CONSTRAINT "knowledge_evidence_event_refs_event_id_knowledge_evidence_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."knowledge_evidence_events"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "knowledge_evidence_events" ADD CONSTRAINT "knowledge_evidence_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "knowledge_evidence_source_links" ADD CONSTRAINT "knowledge_evidence_source_links_evidence_id_knowledge_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."knowledge_evidence"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "knowledge_insight_evidence" ADD CONSTRAINT "knowledge_insight_evidence_insight_id_knowledge_insights_id_fk" FOREIGN KEY ("insight_id") REFERENCES "public"."knowledge_insights"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "knowledge_insight_evidence" ADD CONSTRAINT "knowledge_insight_evidence_evidence_id_knowledge_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."knowledge_evidence"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "knowledge_insights" ADD CONSTRAINT "knowledge_insights_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "knowledge_generation_runs" ADD CONSTRAINT "knowledge_generation_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "knowledge_generation_runs" ADD CONSTRAINT "knowledge_generation_runs_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "learning_enrollments" ADD CONSTRAINT "learning_enrollments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "learning_enrollments" ADD CONSTRAINT "learning_enrollments_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "learning_enrollments" ADD CONSTRAINT "learning_enrollments_outline_version_id_course_outline_versions_id_fk" FOREIGN KEY ("outline_version_id") REFERENCES "public"."course_outline_versions"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "learning_enrollments" ADD CONSTRAINT "learning_enrollments_publication_id_course_publications_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."course_publications"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "learning_enrollments" ADD CONSTRAINT "learning_enrollments_snapshot_id_course_publication_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."course_publication_snapshots"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "learning_section_completions" ADD CONSTRAINT "learning_section_completions_enrollment_id_learning_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."learning_enrollments"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "learning_activity_events" ADD CONSTRAINT "learning_activity_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "learning_activity_events" ADD CONSTRAINT "learning_activity_events_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "learning_activity_events" ADD CONSTRAINT "learning_activity_events_enrollment_id_learning_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."learning_enrollments"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "note_tags" ADD CONSTRAINT "note_tags_note_id_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "note_tags" ADD CONSTRAINT "note_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "notes" ADD CONSTRAINT "notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "research_run_sources" ADD CONSTRAINT "research_run_sources_run_id_research_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."research_runs"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "research_run_sources" ADD CONSTRAINT "research_run_sources_task_id_research_run_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."research_run_tasks"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "research_run_tasks" ADD CONSTRAINT "research_run_tasks_run_id_research_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."research_runs"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "research_runs" ADD CONSTRAINT "research_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "research_runs" ADD CONSTRAINT "research_runs_session_id_conversations_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "ai_skins" ADD CONSTRAINT "ai_skins_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "user_skin_preferences" ADD CONSTRAINT "user_skin_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "ai_usage_user_id_idx" ON "ai_usage" USING btree ("user_id");
CREATE INDEX "ai_usage_request_id_idx" ON "ai_usage" USING btree ("request_id");
CREATE INDEX "ai_usage_endpoint_idx" ON "ai_usage" USING btree ("endpoint");
CREATE INDEX "ai_usage_capability_mode_idx" ON "ai_usage" USING btree ("capability_mode");
CREATE INDEX "ai_usage_workflow_idx" ON "ai_usage" USING btree ("workflow");
CREATE INDEX "ai_usage_model_series_idx" ON "ai_usage" USING btree ("model_series");
CREATE INDEX "ai_usage_model_policy_idx" ON "ai_usage" USING btree ("model_policy");
CREATE INDEX "ai_usage_created_at_idx" ON "ai_usage" USING btree ("created_at");
CREATE INDEX "user_profiles_user_id_idx" ON "user_profiles" USING btree ("user_id");
CREATE INDEX "billing_orders_user_status_idx" ON "billing_orders" USING btree ("user_id","status");
CREATE UNIQUE INDEX "billing_orders_provider_order_unique_idx" ON "billing_orders" USING btree ("provider","provider_order_id");
CREATE INDEX "billing_orders_created_at_idx" ON "billing_orders" USING btree ("created_at");
CREATE UNIQUE INDEX "billing_webhook_events_provider_event_unique_idx" ON "billing_webhook_events" USING btree ("provider","event_id");
CREATE UNIQUE INDEX "redeem_code_redemptions_code_user_unique_idx" ON "redeem_code_redemptions" USING btree ("code_id","user_id");
CREATE UNIQUE INDEX "redeem_codes_code_hash_unique_idx" ON "redeem_codes" USING btree ("code_hash");
CREATE INDEX "user_entitlements_user_expires_idx" ON "user_entitlements" USING btree ("user_id","expires_at");
CREATE UNIQUE INDEX "user_entitlements_source_unique_idx" ON "user_entitlements" USING btree ("source","source_ref_id");
CREATE UNIQUE INDEX "career_plan_revisions_session_revision_unique_idx" ON "career_plan_revisions" USING btree ("session_id","revision_index");
CREATE INDEX "career_plan_revisions_user_created_idx" ON "career_plan_revisions" USING btree ("user_id","created_at");
CREATE INDEX "career_plan_revisions_session_idx" ON "career_plan_revisions" USING btree ("session_id");
CREATE INDEX "career_planning_sessions_user_status_idx" ON "career_planning_sessions" USING btree ("user_id","status");
CREATE INDEX "career_planning_sessions_conversation_idx" ON "career_planning_sessions" USING btree ("conversation_id");
CREATE UNIQUE INDEX "career_course_chapter_evidence_unique_idx" ON "career_course_chapter_evidence" USING btree ("user_id","course_id","chapter_key");
CREATE INDEX "career_course_chapter_evidence_user_course_idx" ON "career_course_chapter_evidence" USING btree ("user_id","course_id");
CREATE INDEX "career_course_skill_evidence_user_course_idx" ON "career_course_skill_evidence" USING btree ("user_id","course_id");
CREATE INDEX "career_course_skill_evidence_extract_run_idx" ON "career_course_skill_evidence" USING btree ("extract_run_id");
CREATE INDEX "career_course_skill_evidence_source_outline_idx" ON "career_course_skill_evidence" USING btree ("user_id","course_id","source_outline_hash");
CREATE UNIQUE INDEX "career_generation_runs_idempotency_key_unique_idx" ON "career_generation_runs" USING btree ("idempotency_key");
CREATE INDEX "career_generation_runs_user_kind_idx" ON "career_generation_runs" USING btree ("user_id","kind");
CREATE INDEX "career_generation_runs_course_idx" ON "career_generation_runs" USING btree ("course_id");
CREATE INDEX "career_user_skill_edges_user_idx" ON "career_user_skill_edges" USING btree ("user_id");
CREATE UNIQUE INDEX "career_user_skill_edges_unique_idx" ON "career_user_skill_edges" USING btree ("user_id","from_node_id","to_node_id","edge_type");
CREATE UNIQUE INDEX "career_user_skill_node_evidence_unique_idx" ON "career_user_skill_node_evidence" USING btree ("node_id","course_skill_evidence_id");
CREATE INDEX "career_user_skill_node_evidence_user_node_idx" ON "career_user_skill_node_evidence" USING btree ("user_id","node_id");
CREATE INDEX "career_user_skill_node_evidence_evidence_idx" ON "career_user_skill_node_evidence" USING btree ("course_skill_evidence_id");
CREATE INDEX "career_user_skill_nodes_user_idx" ON "career_user_skill_nodes" USING btree ("user_id");
CREATE INDEX "career_user_skill_nodes_user_canonical_idx" ON "career_user_skill_nodes" USING btree ("user_id","canonical_label");
CREATE INDEX "career_user_tree_preferences_selected_direction_idx" ON "career_user_tree_preferences" USING btree ("selected_direction_key");
CREATE INDEX "career_user_tree_snapshots_user_latest_idx" ON "career_user_tree_snapshots" USING btree ("user_id","is_latest");
CREATE INDEX "career_user_tree_snapshots_user_created_idx" ON "career_user_tree_snapshots" USING btree ("user_id","created_at");
CREATE INDEX "conversation_messages_conversation_idx" ON "conversation_messages" USING btree ("conversation_id");
CREATE UNIQUE INDEX "conversation_messages_conversation_position_idx" ON "conversation_messages" USING btree ("conversation_id","position");
CREATE INDEX "conversations_user_id_idx" ON "conversations" USING btree ("user_id");
CREATE INDEX "conversations_last_message_idx" ON "conversations" USING btree ("last_message_at");
CREATE UNIQUE INDEX "conversations_learn_scope_unique_idx" ON "conversations" USING btree ("user_id","intent","learn_course_id","learn_chapter_index");
CREATE INDEX "course_public_annotations_publication_section_idx" ON "course_public_annotations" USING btree ("publication_id","section_key","status");
CREATE INDEX "course_public_annotations_user_idx" ON "course_public_annotations" USING btree ("user_id");
CREATE UNIQUE INDEX "course_publication_likes_user_publication_unique_idx" ON "course_publication_likes" USING btree ("user_id","publication_id");
CREATE INDEX "course_publication_likes_publication_idx" ON "course_publication_likes" USING btree ("publication_id");
CREATE INDEX "course_publication_snapshots_publication_created_idx" ON "course_publication_snapshots" USING btree ("publication_id","created_at");
CREATE UNIQUE INDEX "course_publication_snapshots_publication_hash_unique_idx" ON "course_publication_snapshots" USING btree ("publication_id","snapshot_hash");
CREATE UNIQUE INDEX "course_publication_subscriptions_user_publication_unique_idx" ON "course_publication_subscriptions" USING btree ("user_id","publication_id");
CREATE INDEX "course_publication_subscriptions_publication_idx" ON "course_publication_subscriptions" USING btree ("publication_id");
CREATE INDEX "course_publication_subscriptions_user_idx" ON "course_publication_subscriptions" USING btree ("user_id");
CREATE UNIQUE INDEX "course_publication_urges_user_publication_unique_idx" ON "course_publication_urges" USING btree ("user_id","publication_id");
CREATE INDEX "course_publication_urges_publication_idx" ON "course_publication_urges" USING btree ("publication_id");
CREATE UNIQUE INDEX "course_publications_source_course_unique_idx" ON "course_publications" USING btree ("source_course_id");
CREATE UNIQUE INDEX "course_publications_slug_unique_idx" ON "course_publications" USING btree ("slug");
CREATE INDEX "course_publications_owner_status_idx" ON "course_publications" USING btree ("owner_user_id","status");
CREATE UNIQUE INDEX "course_outline_nodes_outline_node_unique_idx" ON "course_outline_nodes" USING btree ("outline_version_id","node_key");
CREATE UNIQUE INDEX "course_outline_nodes_outline_semantic_unique_idx" ON "course_outline_nodes" USING btree ("outline_version_id","semantic_id");
CREATE INDEX "course_outline_nodes_course_version_idx" ON "course_outline_nodes" USING btree ("course_id","outline_version_id");
CREATE INDEX "course_outline_nodes_course_type_idx" ON "course_outline_nodes" USING btree ("course_id","node_type");
CREATE INDEX "course_outline_versions_course_latest_idx" ON "course_outline_versions" USING btree ("course_id","is_latest");
CREATE UNIQUE INDEX "course_outline_versions_course_hash_unique_idx" ON "course_outline_versions" USING btree ("course_id","version_hash");
CREATE INDEX "course_section_annotations_section_id_idx" ON "course_section_annotations" USING btree ("course_section_id");
CREATE INDEX "course_section_annotations_user_id_idx" ON "course_section_annotations" USING btree ("user_id");
CREATE INDEX "course_sections_course_id_idx" ON "course_sections" USING btree ("course_id");
CREATE UNIQUE INDEX "course_sections_outline_node_unique_idx" ON "course_sections" USING btree ("outline_node_id");
CREATE UNIQUE INDEX "course_sections_version_node_key_unique_idx" ON "course_sections" USING btree ("outline_version_id","outline_node_key");
CREATE INDEX "courses_user_id_idx" ON "courses" USING btree ("user_id");
CREATE INDEX "knowledge_evidence_user_kind_idx" ON "knowledge_evidence" USING btree ("user_id","kind");
CREATE INDEX "knowledge_evidence_user_source_idx" ON "knowledge_evidence" USING btree ("user_id","source_type","source_id");
CREATE INDEX "knowledge_evidence_source_version_idx" ON "knowledge_evidence" USING btree ("source_version_hash");
CREATE INDEX "knowledge_evidence_chunks_evidence_idx" ON "knowledge_evidence_chunks" USING btree ("knowledge_evidence_id");
CREATE INDEX "knowledge_evidence_chunks_embedding_hnsw_idx" ON "knowledge_evidence_chunks" USING hnsw ("embedding" vector_cosine_ops) WITH (m=16,ef_construction=64);
CREATE INDEX "knowledge_evidence_chunks_content_search_trgm_idx" ON "knowledge_evidence_chunks" USING gin ("content_search_text" gin_trgm_ops);
CREATE INDEX "knowledge_evidence_chunks_content_search_fts_idx" ON "knowledge_evidence_chunks" USING gin (to_tsvector('simple', "content_search_text"));
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
CREATE UNIQUE INDEX "knowledge_generation_runs_idempotency_key_unique_idx" ON "knowledge_generation_runs" USING btree ("idempotency_key");
CREATE INDEX "knowledge_generation_runs_user_kind_idx" ON "knowledge_generation_runs" USING btree ("user_id","kind");
CREATE INDEX "knowledge_generation_runs_course_idx" ON "knowledge_generation_runs" USING btree ("course_id");
CREATE INDEX "domain_outbox_events_pending_idx" ON "domain_outbox_events" USING btree ("processed_at","available_at");
CREATE INDEX "domain_outbox_events_aggregate_idx" ON "domain_outbox_events" USING btree ("aggregate_type","aggregate_id");
CREATE UNIQUE INDEX "learning_enrollments_user_revision_unique_idx" ON "learning_enrollments" USING btree ("user_id","outline_version_id");
CREATE UNIQUE INDEX "learning_enrollments_user_snapshot_unique_idx" ON "learning_enrollments" USING btree ("user_id","snapshot_id");
CREATE INDEX "learning_enrollments_user_updated_idx" ON "learning_enrollments" USING btree ("user_id","updated_at");
CREATE INDEX "learning_enrollments_course_idx" ON "learning_enrollments" USING btree ("course_id");
CREATE INDEX "learning_enrollments_publication_idx" ON "learning_enrollments" USING btree ("publication_id");
CREATE UNIQUE INDEX "learning_section_completions_enrollment_section_unique_idx" ON "learning_section_completions" USING btree ("enrollment_id","section_id");
CREATE INDEX "learning_section_completions_enrollment_completed_idx" ON "learning_section_completions" USING btree ("enrollment_id","completed_at");
CREATE UNIQUE INDEX "learning_activity_events_idempotency_key_unique_idx" ON "learning_activity_events" USING btree ("idempotency_key");
CREATE INDEX "learning_activity_events_user_occurred_at_idx" ON "learning_activity_events" USING btree ("user_id","occurred_at");
CREATE INDEX "learning_activity_events_course_occurred_at_idx" ON "learning_activity_events" USING btree ("course_id","occurred_at");
CREATE INDEX "learning_activity_events_user_type_occurred_at_idx" ON "learning_activity_events" USING btree ("user_id","event_type","occurred_at");
CREATE INDEX "note_tags_note_idx" ON "note_tags" USING btree ("note_id");
CREATE INDEX "note_tags_tag_idx" ON "note_tags" USING btree ("tag_id");
CREATE INDEX "note_tags_status_idx" ON "note_tags" USING btree ("status");
CREATE UNIQUE INDEX "note_tags_note_tag_unique_idx" ON "note_tags" USING btree ("note_id","tag_id");
CREATE INDEX "notes_user_id_idx" ON "notes" USING btree ("user_id");
CREATE INDEX "notes_source_type_idx" ON "notes" USING btree ("source_type");
CREATE UNIQUE INDEX "notes_user_id_idempotency_key_unique_idx" ON "notes" USING btree ("user_id","idempotency_key");
CREATE INDEX "tags_name_idx" ON "tags" USING btree ("name");
CREATE INDEX "tags_name_embedding_hnsw_idx" ON "tags" USING hnsw ("name_embedding" vector_cosine_ops) WITH (m=16,ef_construction=64);
CREATE UNIQUE INDEX "research_run_sources_run_task_url_unique_idx" ON "research_run_sources" USING btree ("run_id","task_id","url");
CREATE INDEX "research_run_sources_run_idx" ON "research_run_sources" USING btree ("run_id");
CREATE INDEX "research_run_sources_task_idx" ON "research_run_sources" USING btree ("task_id");
CREATE UNIQUE INDEX "research_run_tasks_run_ordinal_unique_idx" ON "research_run_tasks" USING btree ("run_id","ordinal");
CREATE UNIQUE INDEX "research_run_tasks_run_task_key_unique_idx" ON "research_run_tasks" USING btree ("run_id","task_key");
CREATE INDEX "research_run_tasks_run_status_idx" ON "research_run_tasks" USING btree ("run_id","status");
CREATE INDEX "research_runs_user_status_idx" ON "research_runs" USING btree ("user_id","status");
CREATE INDEX "research_runs_session_created_idx" ON "research_runs" USING btree ("session_id","created_at");
CREATE INDEX "research_runs_retry_of_idx" ON "research_runs" USING btree ("retry_of_run_id");
CREATE UNIQUE INDEX "research_runs_queue_job_id_unique_idx" ON "research_runs" USING btree ("queue_job_id");
CREATE INDEX "ai_skins_slug_idx" ON "ai_skins" USING btree ("slug");
CREATE INDEX "ai_skins_author_id_idx" ON "ai_skins" USING btree ("author_id");
CREATE INDEX "ai_skins_is_enabled_idx" ON "ai_skins" USING btree ("is_enabled");
CREATE INDEX "user_skin_preferences_user_id_idx" ON "user_skin_preferences" USING btree ("user_id");
