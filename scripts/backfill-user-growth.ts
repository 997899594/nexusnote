import { closeDbConnection } from "@/db";
import {
  type GrowthRuntimeFilters,
  loadRuntimeBundlesForFilters,
  runRuntimeBundlesBackfill,
} from "@/lib/growth/runtime-maintenance";

interface BackfillArgs extends GrowthRuntimeFilters {
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { targetCourses, bundles } = await loadRuntimeBundlesForFilters(args);

  console.log(
    `[GrowthBackfill] Found ${targetCourses.length} course(s) mode=${args.sync ? "sync" : "queue"} dryRun=${args.dryRun}`,
  );

  if (targetCourses.length === 0) {
    return;
  }

  if (args.dryRun) {
    for (const bundle of bundles) {
      console.log(
        `[GrowthBackfill] user=${bundle.userId} courses=${bundle.courses.length} sections=${bundle.sectionDocuments.length} annotations=${bundle.annotationSources.length} notes=${bundle.notes.length} conversations=${bundle.conversations.length}`,
      );

      for (const course of bundle.courses) {
        console.log(`[GrowthBackfill] Target ${course.title} (${course.id}) user=${course.userId}`);
      }
    }

    console.log("[GrowthBackfill] Done");
    return;
  }

  await runRuntimeBundlesBackfill({
    bundles,
    sync: args.sync,
    onUserStart: async ({ bundle, summary }) => {
      console.log(
        `[GrowthBackfill] user=${bundle.userId} courses=${summary.courses} sections=${summary.sectionDocuments} annotations=${summary.annotationSources} notes=${summary.notes} conversations=${summary.conversations}`,
      );

      for (const course of bundle.courses) {
        console.log(`[GrowthBackfill] Target ${course.title} (${course.id}) user=${course.userId}`);
      }
    },
    onUserComplete: async ({ bundle }) => {
      console.log(`[GrowthBackfill] Completed user ${bundle.userId}`);
    },
  });

  console.log("[GrowthBackfill] Done");
}

main()
  .catch((error) => {
    console.error("[GrowthBackfill] Failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDbConnection();
  });
