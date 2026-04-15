import { and, asc, desc, eq, sql } from "drizzle-orm";
import {
  courses,
  db,
  knowledgeEvidence,
  knowledgeEvidenceEvents,
  knowledgeGenerationRuns,
  userCareerTreeSnapshots,
  userFocusSnapshots,
  userProfileSnapshots,
} from "@/db";
import { getUserGrowthContext } from "@/lib/growth/generation-context";
import {
  focusSnapshotPayloadSchema,
  profileSnapshotPayloadSchema,
} from "@/lib/growth/projection-types";
import { runGrowthCoursePipeline, runGrowthProjectionPipeline } from "@/lib/growth/runtime";
import { careerTreeSnapshotSchema } from "@/lib/growth/types";

interface VerifyArgs {
  courseId?: string;
  userId?: string;
  limit?: number;
  skipRun: boolean;
}

interface VerifyCourse {
  id: string;
  userId: string;
  title: string;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function parseArgs(argv: string[]): VerifyArgs {
  const args: VerifyArgs = {
    skipRun: false,
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
      case "--skip-run":
        args.skipRun = true;
        break;
      default:
        break;
    }
  }

  return args;
}

async function loadTargetCourses(args: VerifyArgs): Promise<VerifyCourse[]> {
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

function groupCoursesByUser(allCourses: VerifyCourse[]): Map<string, VerifyCourse[]> {
  const grouped = new Map<string, VerifyCourse[]>();
  for (const course of allCourses) {
    const existing = grouped.get(course.userId) ?? [];
    existing.push(course);
    grouped.set(course.userId, existing);
  }
  return grouped;
}

async function ensureRuntimeExecuted(
  targetCourses: VerifyCourse[],
  skipRun: boolean,
): Promise<void> {
  if (skipRun) {
    return;
  }

  const grouped = groupCoursesByUser(targetCourses);
  for (const [userId, userCourses] of grouped) {
    console.log(`[GrowthVerify] Running runtime pipeline for user ${userId}`);
    for (const course of userCourses) {
      console.log(`[GrowthVerify] Course pipeline ${course.title} (${course.id})`);
      await runGrowthCoursePipeline({
        userId,
        courseId: course.id,
      });
    }
    await runGrowthProjectionPipeline(userId);
  }
}

async function verifyCourse(course: VerifyCourse): Promise<void> {
  const [eventCountRow, evidenceCountRow, latestExtractRun, latestMergeRun] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(knowledgeEvidenceEvents)
      .where(
        and(
          eq(knowledgeEvidenceEvents.userId, course.userId),
          eq(knowledgeEvidenceEvents.sourceType, "course"),
          eq(knowledgeEvidenceEvents.sourceId, course.id),
        ),
      )
      .then((rows) => rows[0]),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(knowledgeEvidence)
      .where(
        and(
          eq(knowledgeEvidence.userId, course.userId),
          eq(knowledgeEvidence.sourceType, "course"),
          eq(knowledgeEvidence.sourceId, course.id),
        ),
      )
      .then((rows) => rows[0]),
    db.query.knowledgeGenerationRuns.findFirst({
      where: and(
        eq(knowledgeGenerationRuns.userId, course.userId),
        eq(knowledgeGenerationRuns.courseId, course.id),
        eq(knowledgeGenerationRuns.kind, "extract"),
      ),
      orderBy: desc(knowledgeGenerationRuns.createdAt),
    }),
    db.query.knowledgeGenerationRuns.findFirst({
      where: and(
        eq(knowledgeGenerationRuns.userId, course.userId),
        eq(knowledgeGenerationRuns.courseId, course.id),
        eq(knowledgeGenerationRuns.kind, "merge"),
      ),
      orderBy: desc(knowledgeGenerationRuns.createdAt),
    }),
  ]);

  assert((eventCountRow?.count ?? 0) > 0, `course ${course.id} has no knowledge events`);
  assert((evidenceCountRow?.count ?? 0) > 0, `course ${course.id} has no knowledge evidence`);
  assert(latestExtractRun?.status === "succeeded", `course ${course.id} extract run not succeeded`);
  assert(latestMergeRun?.status === "succeeded", `course ${course.id} merge run not succeeded`);
}

async function verifyUser(userId: string): Promise<void> {
  const [
    treeSnapshotRow,
    focusSnapshotRow,
    profileSnapshotRow,
    latestComposeRun,
    latestProjectionRun,
    latestInsightRun,
  ] = await Promise.all([
    db.query.userCareerTreeSnapshots.findFirst({
      where: and(
        eq(userCareerTreeSnapshots.userId, userId),
        eq(userCareerTreeSnapshots.isLatest, true),
      ),
      orderBy: desc(userCareerTreeSnapshots.createdAt),
    }),
    db.query.userFocusSnapshots.findFirst({
      where: and(eq(userFocusSnapshots.userId, userId), eq(userFocusSnapshots.isLatest, true)),
      orderBy: desc(userFocusSnapshots.createdAt),
    }),
    db.query.userProfileSnapshots.findFirst({
      where: and(eq(userProfileSnapshots.userId, userId), eq(userProfileSnapshots.isLatest, true)),
      orderBy: desc(userProfileSnapshots.createdAt),
    }),
    db.query.knowledgeGenerationRuns.findFirst({
      where: and(
        eq(knowledgeGenerationRuns.userId, userId),
        eq(knowledgeGenerationRuns.kind, "compose"),
      ),
      orderBy: desc(knowledgeGenerationRuns.createdAt),
    }),
    db.query.knowledgeGenerationRuns.findFirst({
      where: and(
        eq(knowledgeGenerationRuns.userId, userId),
        eq(knowledgeGenerationRuns.kind, "projection"),
      ),
      orderBy: desc(knowledgeGenerationRuns.createdAt),
    }),
    db.query.knowledgeGenerationRuns.findFirst({
      where: and(
        eq(knowledgeGenerationRuns.userId, userId),
        eq(knowledgeGenerationRuns.kind, "insight"),
      ),
      orderBy: desc(knowledgeGenerationRuns.createdAt),
    }),
  ]);

  assert(treeSnapshotRow, `user ${userId} missing latest career tree snapshot`);
  assert(focusSnapshotRow, `user ${userId} missing latest focus snapshot`);
  assert(profileSnapshotRow, `user ${userId} missing latest profile snapshot`);
  assert(latestComposeRun?.status === "succeeded", `user ${userId} compose run not succeeded`);
  assert(
    latestProjectionRun?.status === "succeeded",
    `user ${userId} projection run not succeeded`,
  );
  assert(latestInsightRun?.status === "succeeded", `user ${userId} insight run not succeeded`);

  const treeSnapshot = careerTreeSnapshotSchema.parse(treeSnapshotRow.payload);
  const focusSnapshot = focusSnapshotPayloadSchema.parse(focusSnapshotRow.payload);
  const profileSnapshot = profileSnapshotPayloadSchema.parse(profileSnapshotRow.payload);

  assert(treeSnapshot.status === "ready", `user ${userId} latest tree snapshot is not ready`);
  assert(
    treeSnapshot.trees.length >= 1 && treeSnapshot.trees.length <= 5,
    `user ${userId} tree count ${treeSnapshot.trees.length} is outside 1-5`,
  );
  assert(
    Boolean(focusSnapshot.treeTitle || focusSnapshot.node?.title),
    `user ${userId} focus snapshot missing title`,
  );
  assert(
    Boolean(profileSnapshot.currentDirection || profileSnapshot.focus),
    `user ${userId} profile snapshot missing direction and focus`,
  );

  const growthContext = await getUserGrowthContext(userId);
  assert(
    Boolean(
      growthContext.currentDirection || growthContext.currentFocus || growthContext.insights.length,
    ),
    `user ${userId} growth context is empty after runtime pipeline`,
  );

  console.log(
    `[GrowthVerify] user=${userId} trees=${treeSnapshot.trees.length} focus=${focusSnapshot.node?.title ?? focusSnapshot.treeTitle ?? "none"}`,
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const targetCourses = await loadTargetCourses(args);

  assert(targetCourses.length > 0, "no courses matched verification filters");
  console.log(`[GrowthVerify] verifying ${targetCourses.length} course(s) skipRun=${args.skipRun}`);

  await ensureRuntimeExecuted(targetCourses, args.skipRun);

  for (const course of targetCourses) {
    await verifyCourse(course);
    console.log(`[GrowthVerify] course=${course.id} title=${course.title} ok`);
  }

  for (const userId of new Set(targetCourses.map((course) => course.userId))) {
    await verifyUser(userId);
  }

  console.log("[GrowthVerify] runtime chain verified");
}

main().catch((error) => {
  console.error("[GrowthVerify] Failed:", error);
  process.exitCode = 1;
});
