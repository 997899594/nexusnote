import { eq } from "drizzle-orm";
import { courseChapterSkillMappings, courseSkillMappings, courses, db } from "@/db";
import { deriveCourseSkillMappings } from "@/lib/golden-path/mapping";
import type { CourseOutline } from "@/lib/learning/course-service";

function isCourseOutline(value: unknown): value is CourseOutline {
  if (!value || typeof value !== "object") {
    return false;
  }

  const outline = value as Partial<CourseOutline>;
  return (
    typeof outline.title === "string" &&
    typeof outline.description === "string" &&
    Array.isArray(outline.chapters)
  );
}

async function backfillCourse(course: { id: string; title: string; outlineData: unknown }) {
  if (!isCourseOutline(course.outlineData)) {
    console.warn(
      `[BackfillMappings] Skip ${course.id}: outline_data is not a valid course outline`,
    );
    return;
  }

  const derivedMappings = deriveCourseSkillMappings(course.outlineData);

  await db.transaction(async (tx) => {
    await tx
      .delete(courseChapterSkillMappings)
      .where(eq(courseChapterSkillMappings.courseId, course.id));
    await tx.delete(courseSkillMappings).where(eq(courseSkillMappings.courseId, course.id));

    if (derivedMappings.courseMappings.length > 0) {
      await tx.insert(courseSkillMappings).values(
        derivedMappings.courseMappings.map((mapping) => ({
          courseId: course.id,
          skillKey: mapping.skillId,
          source:
            mapping.source === "outline_explicit"
              ? "outline_explicit_backfill"
              : "heuristic_backfill",
          confidence: mapping.confidence,
          metadata: mapping.metadata,
          updatedAt: new Date(),
        })),
      );
    }

    if (derivedMappings.chapterMappings.length > 0) {
      await tx.insert(courseChapterSkillMappings).values(
        derivedMappings.chapterMappings.map((mapping) => ({
          courseId: course.id,
          chapterIndex: mapping.chapterIndex,
          skillKey: mapping.skillId,
          source:
            mapping.source === "outline_explicit"
              ? "outline_explicit_backfill"
              : "heuristic_backfill",
          confidence: mapping.confidence,
          metadata: mapping.metadata,
          updatedAt: new Date(),
        })),
      );
    }
  });

  console.log(
    `[BackfillMappings] ${course.title} (${course.id}) -> course=${derivedMappings.courseMappings.length} chapter=${derivedMappings.chapterMappings.length}`,
  );
}

async function main() {
  const allCourses = await db
    .select({
      id: courses.id,
      title: courses.title,
      outlineData: courses.outlineData,
    })
    .from(courses);

  console.log(`[BackfillMappings] Found ${allCourses.length} courses`);

  for (const course of allCourses) {
    await backfillCourse(course);
  }

  console.log("[BackfillMappings] Done");
}

main().catch((error) => {
  console.error("[BackfillMappings] Failed:", error);
  process.exitCode = 1;
});
