import { EMBEDDING_DIMENSIONS } from "@/config/embedding";
import { db, runtimeHeartbeats, sql } from "@/db";
import { assertOutboxOperational } from "@/lib/operations/outbox-operations";
import { getRedis } from "@/lib/redis";
import { REQUIRED_SCHEMA_RELEASE } from "@/lib/release/schema-release";
import { queueWorkerRuntimeDefinition } from "@/lib/worker-runtime/registry";
import packageJson from "@/package.json";

type CheckStatus = "pass" | "fail";

interface DependencyCheckResult {
  status: CheckStatus;
  latencyMs: number;
  error?: string;
  details?: Record<string, unknown>;
}

interface HealthReport {
  status: "healthy" | "degraded";
  timestamp: string;
  version: string;
  buildSha: string;
  schemaRelease: string;
  checks: Record<string, DependencyCheckResult>;
}

const CHECK_TIMEOUT_MS = 1500;
type HealthDatabaseExecutor = Pick<typeof db, "execute">;
const REQUIRED_TABLES = [
  "app_schema_releases",
  "ai_capability_usage_events",
  "billing_orders",
  "course_public_annotations",
  "course_publication_likes",
  "course_publication_subscriptions",
  "course_publication_urges",
  "domain_outbox_events",
  "learning_activity_events",
  "learning_activation_projections",
  "learning_enrollments",
  "learning_section_completions",
  "runtime_worker_heartbeats",
  "product_access_grants",
  "user_entitlements",
] as const;

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

async function withDatabaseDeadline<T>(
  task: (executor: HealthDatabaseExecutor) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('statement_timeout', ${`${CHECK_TIMEOUT_MS}ms`}, true)`);
    return task(tx);
  });
}

async function assertSchemaCompatibility(executor: HealthDatabaseExecutor): Promise<void> {
  const [release] = await executor.execute<{ version: string }>(sql`
    select version from app_schema_releases where version = ${REQUIRED_SCHEMA_RELEASE} limit 1
  `);
  if (!release) throw new Error(`Required schema release is missing: ${REQUIRED_SCHEMA_RELEASE}`);

  const tables = await executor.execute<{ table_name: string }>(sql`
    select table_name from information_schema.tables where table_schema = 'public'
  `);
  const existing = new Set(tables.map((table) => table.table_name));
  const missing = REQUIRED_TABLES.filter((table) => !existing.has(table));
  if (missing.length > 0) throw new Error(`Missing required tables: ${missing.join(", ")}`);

  const [vectorContract] = await executor.execute<{
    vector_type: string;
    indexdef: string | null;
  }>(sql`
    select
      format_type(attribute.atttypid, attribute.atttypmod) as vector_type,
      (
        select indexdef
        from pg_indexes
        where schemaname = 'public'
          and indexname = 'knowledge_evidence_chunks_embedding_hnsw_idx'
      ) as indexdef
    from pg_attribute attribute
    join pg_class relation on relation.oid = attribute.attrelid
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = 'knowledge_evidence_chunks'
      and attribute.attname = 'embedding'
      and not attribute.attisdropped
  `);
  const expectedVectorType = `vector(${EMBEDDING_DIMENSIONS})`;
  if (vectorContract?.vector_type !== expectedVectorType) {
    throw new Error(`Embedding type mismatch: expected ${expectedVectorType}`);
  }
  if (
    !vectorContract.indexdef?.toLowerCase().includes("using hnsw") ||
    !vectorContract.indexdef.toLowerCase().includes("vector_cosine_ops")
  ) {
    throw new Error("Embedding HNSW cosine index is missing or misconfigured");
  }
}

async function assertWorkerHeartbeat(
  executor: HealthDatabaseExecutor,
): Promise<{ activeWorkers: number }> {
  const expectedWorkers = queueWorkerRuntimeDefinition.workers.map((worker) => worker.name);
  const heartbeats = await executor.execute<{ worker_name: string }>(sql`
    select distinct ${runtimeHeartbeats.workerName} as worker_name
    from ${runtimeHeartbeats}
    where ${runtimeHeartbeats.runtimeName} = ${queueWorkerRuntimeDefinition.runtimeName}
      and ${runtimeHeartbeats.workerName} in (${sql.join(
        expectedWorkers.map((worker) => sql`${worker}`),
        sql`, `,
      )})
      and ${runtimeHeartbeats.lastSeenAt} > now() - interval '60 seconds'
  `);
  const activeWorkers = new Set(heartbeats.map((heartbeat) => heartbeat.worker_name));
  const missingWorkers = expectedWorkers.filter((worker) => !activeWorkers.has(worker));
  if (missingWorkers.length > 0) {
    throw new Error(`Queue worker heartbeat is stale or missing: ${missingWorkers.join(", ")}`);
  }
  return { activeWorkers: activeWorkers.size };
}

async function runCheck(
  task: () => Promise<unknown>,
  options: { clientTimeout?: boolean } = {},
): Promise<DependencyCheckResult> {
  const startedAt = Date.now();
  try {
    const result = options.clientTimeout
      ? await Promise.race([
          task(),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error(`Timed out after ${CHECK_TIMEOUT_MS}ms`)),
              CHECK_TIMEOUT_MS,
            ),
          ),
        ])
      : await task();
    return {
      status: "pass",
      latencyMs: Date.now() - startedAt,
      details:
        typeof result === "object" && result !== null
          ? (result as Record<string, unknown>)
          : undefined,
    };
  } catch (error) {
    return { status: "fail", latencyMs: Date.now() - startedAt, error: getErrorMessage(error) };
  }
}

function createHealthReport(checks: Record<string, DependencyCheckResult>): HealthReport {
  const healthy = Object.values(checks).every((check) => check.status === "pass");
  return {
    status: healthy ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),
    version: packageJson.version,
    buildSha: process.env.APP_BUILD_SHA ?? "unknown",
    schemaRelease: REQUIRED_SCHEMA_RELEASE,
    checks,
  };
}

export function createHealthResponse(report: HealthReport): Response {
  return Response.json(report, {
    status: report.status === "healthy" ? 200 : 503,
    headers: { "Cache-Control": "no-cache, no-store, must-revalidate" },
  });
}

export function getLivenessReport(): HealthReport {
  return createHealthReport({ process: { status: "pass", latencyMs: 0 } });
}

export async function getReadinessReport(): Promise<HealthReport> {
  const [database, redis, schema] = await Promise.all([
    runCheck(() => withDatabaseDeadline((executor) => executor.execute(sql`select 1`))),
    runCheck(() => getRedis().ping(), { clientTimeout: true }),
    runCheck(() => withDatabaseDeadline(assertSchemaCompatibility)),
  ]);
  return createHealthReport({ database, redis, schema });
}

export async function getSystemHealthReport(): Promise<HealthReport> {
  const [readiness, workers, outbox] = await Promise.all([
    getReadinessReport(),
    runCheck(() => withDatabaseDeadline(assertWorkerHeartbeat)),
    runCheck(() => withDatabaseDeadline(assertOutboxOperational)),
  ]);
  return createHealthReport({ ...readiness.checks, workers, outbox });
}
