import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";

const outdir = ".worker-runtime";
const entrypoint = "scripts/start-workers.ts";

await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });

const result = await Bun.build({
  entrypoints: [entrypoint],
  outdir,
  target: "bun",
  minify: false,
  sourcemap: "external",
});

if (!result.success) {
  for (const log of result.logs) {
    console.error(log);
  }
  process.exitCode = 1;
  throw new Error("Worker runtime build failed.");
}

console.log(`worker runtime built: ${join(outdir, "start-workers.js")}`);
