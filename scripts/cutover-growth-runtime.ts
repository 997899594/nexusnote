import { closeDbConnection } from "@/db";
import {
  loadRuntimeBundlesForFilters,
  runRuntimeBundlesBackfill,
  verifyRuntimeBundles,
} from "@/lib/growth/runtime-maintenance";
import { applyTrackedMigrations, describeTrackedMigrationCommand } from "./db-maintenance.mjs";

interface CutoverArgs {
  courseId?: string;
  userId?: string;
  limit?: number;
  dryRun: boolean;
  skipApply: boolean;
  skipBackfill: boolean;
  skipVerify: boolean;
}

function parseArgs(argv: string[]): CutoverArgs {
  const args: CutoverArgs = {
    dryRun: false,
    skipApply: false,
    skipBackfill: false,
    skipVerify: false,
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
      case "--dry-run":
        args.dryRun = true;
        break;
      case "--skip-apply":
        args.skipApply = true;
        break;
      case "--skip-backfill":
        args.skipBackfill = true;
        break;
      case "--skip-verify":
        args.skipVerify = true;
        break;
      default:
        break;
    }
  }

  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  if (!args.skipApply) {
    console.log("[GrowthCutover] Applying tracked Drizzle migrations");
    if (args.dryRun) {
      console.log(`[GrowthCutover] db:migrate: would run ${describeTrackedMigrationCommand()}`);
    } else {
      await applyTrackedMigrations(connectionString);
    }
  }

  if (args.skipBackfill && args.skipVerify) {
    console.log("[GrowthCutover] Done");
    return;
  }

  const runtimePlan = await loadRuntimeBundlesForFilters({
    courseId: args.courseId,
    userId: args.userId,
    limit: args.limit,
  });

  console.log(
    `[GrowthCutover] Found ${runtimePlan.targetCourses.length} course(s) across ${runtimePlan.bundles.length} user bundle(s)`,
  );

  if (runtimePlan.targetCourses.length === 0) {
    if (args.skipVerify) {
      console.log("[GrowthCutover] No matching runtime targets");
      return;
    }

    throw new Error("no courses matched cutover filters");
  }

  if (!args.skipBackfill) {
    if (args.dryRun) {
      console.log("[GrowthCutover] growth-backfill: would run synchronous runtime backfill");
    } else {
      await runRuntimeBundlesBackfill({
        bundles: runtimePlan.bundles,
        sync: true,
        onUserStart: async ({ bundle, summary }) => {
          console.log(
            `[GrowthCutover] backfill user=${bundle.userId} courses=${summary.courses} sections=${summary.sectionDocuments} annotations=${summary.annotationSources} notes=${summary.notes} conversations=${summary.conversations}`,
          );
        },
        onUserComplete: async ({ bundle }) => {
          console.log(`[GrowthCutover] backfill user=${bundle.userId} complete`);
        },
      });
    }
  }

  if (!args.skipVerify) {
    if (args.dryRun) {
      console.log("[GrowthCutover] growth-verify: would verify runtime snapshots and evidence");
    } else {
      await verifyRuntimeBundles({
        targetCourses: runtimePlan.targetCourses,
        bundles: runtimePlan.bundles,
        runBeforeVerify: false,
        onCourseVerified: async ({ course }) => {
          console.log(`[GrowthCutover] verify course=${course.id} title=${course.title} ok`);
        },
        onUserVerified: async ({ userId, treeCount, focusTitle }) => {
          console.log(
            `[GrowthCutover] verify user=${userId} trees=${treeCount} focus=${focusTitle ?? "none"}`,
          );
        },
      });
    }
  }

  console.log("[GrowthCutover] Done");
}

main()
  .catch((error) => {
    console.error("[GrowthCutover] Failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDbConnection();
  });
