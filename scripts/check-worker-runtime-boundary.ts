import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const entrypoint = "scripts/start-workers.ts";
const forbiddenPatterns = [
  "server-only",
  "next/cache",
  "next/server",
  "This module cannot be imported from a Client Component module",
] as const;

const outdir = await mkdtemp(join(tmpdir(), "nexusnote-worker-boundary-"));

try {
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
