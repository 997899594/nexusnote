import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const entrypoint = "scripts/start-workers.ts";
const workerOwnedSources = [
  "scripts/start-workers.ts",
  "scripts/start-career-tree-worker.ts",
  "scripts/start-course-production-worker.ts",
  "scripts/start-knowledge-insights-worker.ts",
  "scripts/start-rag-worker.ts",
  "scripts/start-research-worker.ts",
  "scripts/worker-runtime.ts",
  "lib/queue/career-tree-worker.ts",
  "lib/queue/course-production-worker.ts",
  "lib/queue/knowledge-insights-worker.ts",
  "lib/queue/rag-worker.ts",
  "lib/queue/research-worker.ts",
  "lib/ai/workflows/course-section-production.ts",
  "lib/career-tree/aggregation.ts",
  "lib/career-tree/compose.ts",
  "lib/career-tree/extract.ts",
  "lib/career-tree/merge.ts",
  "lib/knowledge/insights/jobs.ts",
] as const;
const forbiddenSourceImports = [
  '"server-only"',
  '"next/cache"',
  '"next/server"',
  '"@/lib/api"',
  '"@/lib/cache/domain-events"',
  '"@/lib/learning/course-sharing"',
  "'server-only'",
  "'next/cache'",
  "'next/server'",
  "'@/lib/api'",
  "'@/lib/cache/domain-events'",
  "'@/lib/learning/course-sharing'",
] as const;
const forbiddenPatterns = [
  "server-only",
  "next/cache",
  "next/server",
  "This module cannot be imported from a Client Component module",
] as const;

async function checkStaticWorkerImports() {
  const violations: Array<{ source: string; pattern: string }> = [];

  for (const source of workerOwnedSources) {
    const content = await readFile(source, "utf8");
    for (const pattern of forbiddenSourceImports) {
      if (content.includes(pattern)) {
        violations.push({ source, pattern });
      }
    }
  }

  if (violations.length === 0) {
    return;
  }

  console.error("Worker-owned source imports web-runtime-only modules:");
  for (const violation of violations) {
    console.error(`- ${violation.source}: ${violation.pattern}`);
  }
  process.exitCode = 1;
  throw new Error("Worker static import boundary check failed.");
}

const outdir = await mkdtemp(join(tmpdir(), "nexusnote-worker-boundary-"));

try {
  await checkStaticWorkerImports();

  const result = await Bun.build({
    entrypoints: [entrypoint],
    outdir,
    target: "bun",
  });

  if (!result.success) {
    for (const log of result.logs) {
      console.error(log);
    }
    process.exitCode = 1;
    throw new Error("Worker runtime bundle failed.");
  }

  const bundle = await readFile(join(outdir, "start-workers.js"), "utf8");
  const violations = forbiddenPatterns.filter((pattern) => bundle.includes(pattern));

  if (violations.length > 0) {
    console.error("Worker runtime bundle imports Next.js web-runtime-only modules:");
    for (const violation of violations) {
      console.error(`- ${violation}`);
    }
    process.exitCode = 1;
    throw new Error("Worker runtime boundary check failed.");
  }

  console.log("worker runtime boundary check passed");
} finally {
  await rm(outdir, { recursive: true, force: true });
}
