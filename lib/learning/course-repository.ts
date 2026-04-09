import { and, courses, db, eq } from "@/db";

type CourseRecord = typeof courses.$inferSelect;
type CourseLookupExecutor = Pick<typeof db, "select">;

export async function getOwnedCourse(
  courseId: string,
  userId: string,
  executor: CourseLookupExecutor = db,
): Promise<CourseRecord | null> {
  const [course] = await executor
    .select()
    .from(courses)
    .where(and(eq(courses.id, courseId), eq(courses.userId, userId)))
    .limit(1);

  return course ?? null;
}
