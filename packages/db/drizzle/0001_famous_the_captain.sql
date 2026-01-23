CREATE TABLE IF NOT EXISTS "flashcards" (
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
CREATE TABLE IF NOT EXISTS "review_logs" (
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
DO $$ BEGIN
 ALTER TABLE "flashcards" ADD CONSTRAINT "flashcards_highlight_id_learning_highlights_id_fk" FOREIGN KEY ("highlight_id") REFERENCES "public"."learning_highlights"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "flashcards" ADD CONSTRAINT "flashcards_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "review_logs" ADD CONSTRAINT "review_logs_flashcard_id_flashcards_id_fk" FOREIGN KEY ("flashcard_id") REFERENCES "public"."flashcards"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "flashcards_due_idx" ON "flashcards" ("due");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "flashcards_state_idx" ON "flashcards" ("state");