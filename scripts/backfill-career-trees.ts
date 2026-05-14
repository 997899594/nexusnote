import { closeDbConnection } from "@/db";
import { processCareerTreeComposeJob } from "@/lib/career-tree/compose";
import { processCareerTreeExtractJob } from "@/lib/career-tree/extract";
import { processCareerTreeMergeJob } from "@/lib/career-tree/merge";
import { enqueueCareerTreeExtract } from "@/lib/career-tree/queue";
import { listCareerCourseSourcesForUser } from "@/lib/career-tree/source";

interface BackfillArgs {
  userId?: string;
  courseId?: string;
  limit?: number;
  sync: boolean;
  dryRun: boolean;
}

function parseArgs(argv: string[]): BackfillArgs {
  const args: BackfillArgs = {
    sync: false,
    dryRun: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    switch (value) {
      case "--user":
        args.userId = argv[index + 1];
        index += 1;
        break;
      case "--course":
        args.courseId = argv[index + 1];
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

async function runQueuedBackfill(targets: Array<{ userId: string; courseId: string }>) {
  for (const target of targets) {
    const queued = await enqueueCareerTreeExtract(target.userId, target.courseId);
    console.log(
      `[CareerTreeBackfill] queued ${queued.type} job=${queued.id ?? "(pending)"} user=${target.userId} course=${target.courseId}`,
    );
  }
}

async function runSyncBackfill(targets: Array<{ userId: string; courseId: string }>) {
  const userIds = [...new Set(targets.map((target) => target.userId))];

  for (const target of targets) {
    console.log(`[CareerTreeBackfill] extracting user=${target.userId} course=${target.courseId}`);
    await processCareerTreeExtractJob({
      userId: target.userId,
      courseId: target.courseId,
      enqueueFollowups: false,
    });
    console.log(`[CareerTreeBackfill] merging user=${target.userId} course=${target.courseId}`);
    await processCareerTreeMergeJob({
      userId: target.userId,
      courseId: target.courseId,
      enqueueFollowups: false,
    });
  }

  for (const userId of userIds) {
    console.log(`[CareerTreeBackfill] composing user=${userId}`);
    await processCareerTreeComposeJob({ userId });
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const targets = await listCareerCourseSourcesForUser({
    userId: args.userId,
    courseId: args.courseId,
    limit: args.limit,
  });

  console.log(
    `[CareerTreeBackfill] Found ${targets.length} course(s) mode=${args.sync ? "sync" : "queue"} dryRun=${args.dryRun}`,
  );

  if (args.dryRun) {
    for (const target of targets) {
      console.log(`[CareerTreeBackfill] target user=${target.userId} course=${target.courseId}`);
    }
    return;
  }

  if (args.sync) {
    await runSyncBackfill(targets);
  } else {
    await runQueuedBackfill(targets);
  }

  console.log("[CareerTreeBackfill] Done");
}

main()
  .catch((error) => {
    console.error("[CareerTreeBackfill] Failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDbConnection();
  });
