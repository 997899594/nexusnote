import { mkdir, rm } from "node:fs/promises";
import { basename, extname, join } from "node:path";

type BuildWorkerRuntimeOptions = {
  entrypoint?: string;
  outdir?: string;
};

export async function buildWorkerRuntime(options: BuildWorkerRuntimeOptions = {}): Promise<void> {
  const outdir = options.outdir ?? ".worker-runtime";
  const entrypoint = options.entrypoint ?? "scripts/start-workers.ts";

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

  const outputFile = `${basename(entrypoint, extname(entrypoint))}.js`;

  console.log(`worker runtime built: ${join(outdir, outputFile)}`);
}

if (import.meta.main) {
  await buildWorkerRuntime();
}
