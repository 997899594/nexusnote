ALTER TABLE "notes"
ADD COLUMN "source_type" text DEFAULT 'manual' NOT NULL;

ALTER TABLE "notes"
ADD COLUMN "source_context" jsonb;

CREATE INDEX "notes_source_type_idx" ON "notes" USING btree ("source_type");
