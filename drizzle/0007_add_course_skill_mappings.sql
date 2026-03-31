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

ALTER TABLE "course_skill_mappings"
  ADD CONSTRAINT "course_skill_mappings_course_id_courses_id_fk"
  FOREIGN KEY ("course_id")
  REFERENCES "public"."courses"("id")
  ON DELETE cascade
  ON UPDATE no action;

ALTER TABLE "course_chapter_skill_mappings"
  ADD CONSTRAINT "course_chapter_skill_mappings_course_id_courses_id_fk"
  FOREIGN KEY ("course_id")
  REFERENCES "public"."courses"("id")
  ON DELETE cascade
  ON UPDATE no action;

CREATE INDEX "course_skill_mappings_course_id_idx"
  ON "course_skill_mappings" USING btree ("course_id");

CREATE INDEX "course_skill_mappings_skill_key_idx"
  ON "course_skill_mappings" USING btree ("skill_key");

CREATE UNIQUE INDEX "course_skill_mappings_unique_idx"
  ON "course_skill_mappings" USING btree ("course_id", "skill_key");

CREATE INDEX "course_chapter_skill_mappings_course_id_idx"
  ON "course_chapter_skill_mappings" USING btree ("course_id", "chapter_index");

CREATE INDEX "course_chapter_skill_mappings_skill_key_idx"
  ON "course_chapter_skill_mappings" USING btree ("skill_key");

CREATE UNIQUE INDEX "course_chapter_skill_mappings_unique_idx"
  ON "course_chapter_skill_mappings" USING btree ("course_id", "chapter_index", "skill_key");
