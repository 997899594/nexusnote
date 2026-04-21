import { db, sql } from "@/db";
import { getRedis } from "@/lib/redis";
import packageJson from "@/package.json";

type CheckStatus = "pass" | "fail";

interface DependencyCheckResult {
  status: CheckStatus;
  latencyMs: number;
  error?: string;
}

const CHECK_TIMEOUT_MS = 1500;
const REQUIRED_SCHEMA_COLUMNS = [
  ["conversations", "learn_course_id"],
  ["conversations", "learn_chapter_index"],
] as const;

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown error";
}

function toColumnKey(tableName: string, columnName: string): string {
  return `${tableName}.${columnName}`;
}

async function assertSchemaCompatibility(): Promise<void> {
  const rows = await db.execute<{
    table_name: string;
    column_name: string;
  }>(sql`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND (
        (table_name = 'conversations' AND column_name = 'learn_course_id')
        OR
        (table_name = 'conversations' AND column_name = 'learn_chapter_index')
      )
  `);

  const existingColumns = new Set(rows.map((row) => toColumnKey(row.table_name, row.column_name)));
  const missingColumns = REQUIRED_SCHEMA_COLUMNS.filter(
    ([tableName, columnName]) => !existingColumns.has(toColumnKey(tableName, columnName)),
  ).map(([tableName, columnName]) => toColumnKey(tableName, columnName));

  if (missingColumns.length > 0) {
    throw new Error(`Missing required schema columns: ${missingColumns.join(", ")}`);
  }
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
    runCheck(() => getRedis().ping()),
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
