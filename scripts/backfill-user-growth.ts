import { asc, eq } from "drizzle-orm";
import { courses, db } from "@/db";
import { enqueueGrowthExtract } from "@/lib/growth/queue";
import { runGrowthCoursePipeline, runGrowthProjectionPipeline } from "@/lib/growth/runtime";

interface BackfillArgs {
  courseId?: string;
  userId?: string;
  limit?: number;
  sync: boolean;
  dryRun: boolean;
}

interface BackfillCourse {
  id: string;
  userId: string;
  title: string;
}

function parseArgs(argv: string[]): BackfillArgs {
  const args: BackfillArgs = {
    sync: false,
    dryRun: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    switch (value) {
      case "--course":
        args.courseId = argv[index + 1];
        index += 1;
        break;
      case "--user":
        args.userId = argv[index + 1];
        index += 1;
        break;
      case "--limit":
        args.limit = Number(argv[index + 1]);
        index += 1;
        break;
      case "--sync":
        args.sync = true;
        break;
      case "--dry-run":
        args.dryRun = true;
        break;
      default:
        break;
    }
  }

  return args;
}

async function loadTargetCourses(args: BackfillArgs): Promise<BackfillCourse[]> {
  const query = db
    .select({
      id: courses.id,
      userId: courses.userId,
      title: courses.title,
    })
    .from(courses)
    .where(
      args.courseId
        ? eq(courses.id, args.courseId)
        : args.userId
          ? eq(courses.userId, args.userId)
          : undefined,
    )
    .orderBy(asc(courses.userId), asc(courses.title));

  return typeof args.limit === "number" ? query.limit(args.limit) : query;
}

function groupCoursesByUser(allCourses: BackfillCourse[]): Map<string, BackfillCourse[]> {
  const grouped = new Map<string, BackfillCourse[]>();

  for (const course of allCourses) {
    const existing = grouped.get(course.userId) ?? [];
    existing.push(course);
    grouped.set(course.userId, existing);
  }

  return grouped;
}

async function enqueueBackfill(allCourses: BackfillCourse[]): Promise<void> {
  for (const course of allCourses) {
    await enqueueGrowthExtract(course.userId, course.id);
    console.log(`[GrowthBackfill] Enqueued ${course.title} (${course.id})`);
  }
}

async function runSyncBackfill(allCourses: BackfillCourse[]): Promise<void> {
  const groupedCourses = groupCoursesByUser(allCourses);

  for (const [userId, userCourses] of groupedCourses) {
    console.log(
      `[GrowthBackfill] Sync processing user ${userId} with ${userCourses.length} course(s)`,
    );

    for (const course of userCourses) {
      console.log(`[GrowthBackfill] Sync course ${course.title} (${course.id})`);
      await runGrowthCoursePipeline({
        userId,
        courseId: course.id,
      });
    }

    await runGrowthProjectionPipeline(userId);
    console.log(`[GrowthBackfill] Projection refresh completed for user ${userId}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const allCourses = await loadTargetCourses(args);

  console.log(
    `[GrowthBackfill] Found ${allCourses.length} course(s) mode=${args.sync ? "sync" : "queue"} dryRun=${args.dryRun}`,
  );

  if (allCourses.length === 0) {
    return;
  }

  for (const course of allCourses) {
    console.log(`[GrowthBackfill] Target ${course.title} (${course.id}) user=${course.userId}`);
  }

  if (args.dryRun) {
    return;
  }

  if (args.sync) {
    await runSyncBackfill(allCourses);
  } else {
    await enqueueBackfill(allCourses);
  }

  console.log("[GrowthBackfill] Done");
}

main().catch((error) => {
  console.error("[GrowthBackfill] Failed:", error);
  process.exitCode = 1;
});
