import { closeDbConnection } from "@/db";
import {
  type GrowthRuntimeFilters,
  loadRuntimeBundlesForFilters,
  verifyRuntimeBundles,
} from "@/lib/growth/runtime-maintenance";

interface VerifyArgs extends GrowthRuntimeFilters {
  skipRun: boolean;
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { targetCourses, bundles } = await loadRuntimeBundlesForFilters(args);

  assert(targetCourses.length > 0, "no courses matched verification filters");
  console.log(`[GrowthVerify] verifying ${targetCourses.length} course(s) skipRun=${args.skipRun}`);

  await verifyRuntimeBundles({
    targetCourses,
    bundles,
    runBeforeVerify: !args.skipRun,
    onRuntimeRunStart: async ({ bundle }) => {
      console.log(`[GrowthVerify] Running runtime backfill for user ${bundle.userId}`);
    },
    onCourseVerified: async ({ course }) => {
      console.log(`[GrowthVerify] course=${course.id} title=${course.title} ok`);
    },
    onUserVerified: async ({ userId, treeCount, focusTitle }) => {
      console.log(`[GrowthVerify] user=${userId} trees=${treeCount} focus=${focusTitle ?? "none"}`);
    },
  });

  console.log("[GrowthVerify] runtime chain verified");
}

main()
  .catch((error) => {
    console.error("[GrowthVerify] Failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDbConnection();
  });
