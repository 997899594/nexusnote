ALTER TABLE "course_chapters" RENAME COLUMN "course_id" TO "profile_id";--> statement-breakpoint
ALTER TABLE "course_profiles" DROP CONSTRAINT "course_profiles_course_id_unique";--> statement-breakpoint
ALTER TABLE "course_chapters" DROP CONSTRAINT "course_chapters_course_id_course_profiles_course_id_fk";
--> statement-breakpoint
DROP INDEX "course_chapters_course_id_idx";--> statement-breakpoint
DROP INDEX "course_profiles_course_id_idx";--> statement-breakpoint
ALTER TABLE "course_chapters" ADD CONSTRAINT "course_chapters_profile_id_course_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."course_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "course_chapters_profile_id_idx" ON "course_chapters" USING btree ("profile_id");--> statement-breakpoint
ALTER TABLE "course_profiles" DROP COLUMN "course_id";