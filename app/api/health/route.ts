import { db, sql } from "@/db";
import { redis } from "@/lib/redis";
import { assertSchemaCompatibility } from "@/lib/server/schema-compatibility";
import packageJson from "@/package.json";

type CheckStatus = "pass" | "fail";

interface DependencyCheckResult {
  status: CheckStatus;
  latencyMs: number;
  error?: string;
}

const CHECK_TIMEOUT_MS = 1500;

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown error";
}

async function runCheck(task: () => Promise<unknown>): Promise<DependencyCheckResult> {
  const startedAt = Date.now();

  try {
    await Promise.race([
      task(),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error(`Timed out after ${CHECK_TIMEOUT_MS}ms`)),
          CHECK_TIMEOUT_MS,
        ),
      ),
    ]);

    return {
      status: "pass",
      latencyMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      status: "fail",
      latencyMs: Date.now() - startedAt,
      error: getErrorMessage(error),
    };
  }
}

export async function GET() {
  const [database, redisCheck, schema] = await Promise.all([
    runCheck(() => db.execute(sql`select 1`)),
    runCheck(() => redis.ping()),
    runCheck(() => assertSchemaCompatibility()),
  ]);

  const overallStatus: CheckStatus =
    database.status === "pass" && redisCheck.status === "pass" && schema.status === "pass"
      ? "pass"
      : "fail";

  return Response.json(
    {
      status: overallStatus === "pass" ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      version: packageJson.version,
      buildSha: process.env.APP_BUILD_SHA ?? "unknown",
      checks: {
        database,
        redis: redisCheck,
        schema,
      },
    },
    {
      status: overallStatus === "pass" ? 200 : 503,
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    },
  );
}
