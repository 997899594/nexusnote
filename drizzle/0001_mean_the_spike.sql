CREATE TABLE "persona_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"persona_id" uuid NOT NULL,
	"subscribed_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "personas" (
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
	CONSTRAINT "personas_slug_unique" UNIQUE("slug")
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
CREATE TABLE "user_persona_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"default_persona_slug" text DEFAULT 'default' NOT NULL,
	"last_switched_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "user_persona_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "persona_subscriptions" ADD CONSTRAINT "persona_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "persona_subscriptions" ADD CONSTRAINT "persona_subscriptions_persona_id_personas_id_fk" FOREIGN KEY ("persona_id") REFERENCES "public"."personas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personas" ADD CONSTRAINT "personas_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "style_privacy_settings" ADD CONSTRAINT "style_privacy_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_persona_preferences" ADD CONSTRAINT "user_persona_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_persona_preferences" ADD CONSTRAINT "user_persona_preferences_default_persona_slug_personas_slug_fk" FOREIGN KEY ("default_persona_slug") REFERENCES "public"."personas"("slug") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "persona_subscriptions_unique_idx" ON "persona_subscriptions" USING btree ("user_id","persona_id");--> statement-breakpoint
CREATE INDEX "personas_slug_idx" ON "personas" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "personas_author_id_idx" ON "personas" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "personas_is_enabled_idx" ON "personas" USING btree ("is_enabled");--> statement-breakpoint
CREATE INDEX "style_privacy_settings_user_id_idx" ON "style_privacy_settings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_persona_preferences_user_id_idx" ON "user_persona_preferences" USING btree ("user_id");