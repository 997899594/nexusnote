import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

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

const workerRuntimeOutdir = ".worker-runtime";
const workerRuntimeEntrypoint = "start-workers.js";

async function listJavaScriptFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(dir, entry.name);

      if (entry.isDirectory()) {
        return listJavaScriptFiles(path);
      }

      return entry.isFile() && entry.name.endsWith(".js") ? [path] : [];
    }),
  );

  return files.flat();
}

function createSmokeEnv(): Record<string, string> {
  const env: Record<string, string> = {
    WORKER_RUNTIME_SMOKE: "1",
  };
  const inheritedKeys = ["PATH", "HOME", "TMPDIR", "TEMP", "TMP", "BUN_INSTALL"] as const;

  for (const key of inheritedKeys) {
    const value = process.env[key];
    if (value) {
      env[key] = value;
    }
  }

  return env;
}

await checkStaticWorkerImports();

await import("./build-worker-runtime");

const bundleFiles = await listJavaScriptFiles(workerRuntimeOutdir);
const violations: Array<{ file: string; pattern: string }> = [];

for (const file of bundleFiles) {
  const bundle = await readFile(file, "utf8");
  for (const pattern of forbiddenPatterns) {
    if (bundle.includes(pattern)) {
      violations.push({ file, pattern });
    }
  }
}

if (violations.length > 0) {
  console.error("Worker runtime bundle imports Next.js web-runtime-only modules:");
  for (const violation of violations) {
    console.error(`- ${violation.file}: ${violation.pattern}`);
  }
  process.exitCode = 1;
  throw new Error("Worker runtime boundary check failed.");
}

const smoke = Bun.spawnSync({
  cmd: [process.execPath, workerRuntimeEntrypoint],
  cwd: workerRuntimeOutdir,
  env: createSmokeEnv(),
  stdout: "pipe",
  stderr: "pipe",
});

if (!smoke.success) {
  console.error("Worker runtime smoke failed:");
  console.error(new TextDecoder().decode(smoke.stdout));
  console.error(new TextDecoder().decode(smoke.stderr));
  process.exitCode = smoke.exitCode || 1;
  throw new Error("Worker runtime smoke failed.");
}

console.log("worker runtime boundary check passed");
