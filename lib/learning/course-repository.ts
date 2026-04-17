import { and, courseOutlineNodes, courseOutlineVersions, courses, db, desc, eq } from "@/db";
import type { CourseOutline } from "@/lib/learning/course-outline";
import { materializeCourseOutline } from "@/lib/learning/course-structure";

type CourseRecord = typeof courses.$inferSelect;
type CourseLookupExecutor = Pick<typeof db, "select">;

export interface OwnedCourseWithOutline extends CourseRecord {
  outline: CourseOutline;
  outlineVersionId: string;
  outlineVersionHash: string;
}

async function loadCourseWithLatestOutline(
  course: CourseRecord,
): Promise<OwnedCourseWithOutline | null> {
  const outlineVersion = await db.query.courseOutlineVersions.findFirst({
    where: and(
      eq(courseOutlineVersions.courseId, course.id),
      eq(courseOutlineVersions.isLatest, true),
    ),
    orderBy: desc(courseOutlineVersions.createdAt),
  });
  if (!outlineVersion) {
    return null;
  }

  const nodes = await db
    .select()
    .from(courseOutlineNodes)
    .where(eq(courseOutlineNodes.outlineVersionId, outlineVersion.id));

  return {
    ...course,
    outline: materializeCourseOutline({
      version: outlineVersion,
      nodes,
    }),
    outlineVersionId: outlineVersion.id,
    outlineVersionHash: outlineVersion.versionHash,
  };
}

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

export async function getOwnedCourseWithOutline(
  courseId: string,
  userId: string,
): Promise<OwnedCourseWithOutline | null> {
  const course = await getOwnedCourse(courseId, userId);
  return course ? loadCourseWithLatestOutline(course) : null;
}

export async function getCourseWithOutline(
  courseId: string,
): Promise<OwnedCourseWithOutline | null> {
  const [course] = await db.select().from(courses).where(eq(courses.id, courseId)).limit(1);
  return course ? loadCourseWithLatestOutline(course) : null;
}
