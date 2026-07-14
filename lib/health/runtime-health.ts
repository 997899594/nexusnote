import { EMBEDDING_DIMENSIONS } from "@/config/embedding";
import { db, sql } from "@/db";
import { getRedis } from "@/lib/redis";
import { REQUIRED_SCHEMA_RELEASE } from "@/lib/release/schema-release";
import packageJson from "@/package.json";

type CheckStatus = "pass" | "fail";

interface DependencyCheckResult {
  status: CheckStatus;
  latencyMs: number;
  error?: string;
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
const REQUIRED_TABLES = [
  "app_schema_releases",
  "billing_orders",
  "course_public_annotations",
  "course_publication_likes",
  "course_publication_subscriptions",
  "course_publication_urges",
  "domain_outbox_events",
  "learning_activity_events",
  "learning_enrollments",
  "learning_section_completions",
  "runtime_heartbeats",
  "user_entitlements",
] as const;

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

async function assertSchemaCompatibility(): Promise<void> {
  const [release] = await db.execute<{ version: string }>(sql`
    select version from app_schema_releases where version = ${REQUIRED_SCHEMA_RELEASE} limit 1
  `);
  if (!release) throw new Error(`Required schema release is missing: ${REQUIRED_SCHEMA_RELEASE}`);

  const tables = await db.execute<{ table_name: string }>(sql`
    select table_name from information_schema.tables where table_schema = 'public'
  `);
  const existing = new Set(tables.map((table) => table.table_name));
  const missing = REQUIRED_TABLES.filter((table) => !existing.has(table));
  if (missing.length > 0) throw new Error(`Missing required tables: ${missing.join(", ")}`);

  const [vectorContract] = await db.execute<{ vector_type: string; indexdef: string | null }>(sql`
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

async function assertWorkerHeartbeat(): Promise<void> {
  const [heartbeat] = await db.execute<{ last_seen_at: Date }>(sql`
    select last_seen_at
    from runtime_heartbeats
    where runtime_name = 'QueueWorkersRuntime'
      and last_seen_at > now() - interval '60 seconds'
    limit 1
  `);
  if (!heartbeat) throw new Error("Queue worker runtime heartbeat is stale or missing");
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
    return { status: "pass", latencyMs: Date.now() - startedAt };
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
    runCheck(() => db.execute(sql`select 1`)),
    runCheck(() => getRedis().ping()),
    runCheck(() => assertSchemaCompatibility()),
  ]);
  return createHealthReport({ database, redis, schema });
}

export async function getSystemHealthReport(): Promise<HealthReport> {
  const [readiness, workers] = await Promise.all([
    getReadinessReport(),
    runCheck(() => assertWorkerHeartbeat()),
  ]);
  return createHealthReport({ ...readiness.checks, workers });
}
