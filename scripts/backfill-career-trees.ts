import { courses, db } from "@/db";
import { enqueueCareerTreeExtract } from "@/lib/career-tree/queue";

async function main() {
  const allCourses = await db
    .select({
      id: courses.id,
      userId: courses.userId,
      title: courses.title,
    })
    .from(courses);

  console.log(`[CareerTreeBackfill] Found ${allCourses.length} courses`);

  for (const course of allCourses) {
    await enqueueCareerTreeExtract(course.userId, course.id);
    console.log(`[CareerTreeBackfill] Enqueued ${course.title} (${course.id})`);
  }

  console.log("[CareerTreeBackfill] Done");
}

main().catch((error) => {
  console.error("[CareerTreeBackfill] Failed:", error);
  process.exitCode = 1;
});
