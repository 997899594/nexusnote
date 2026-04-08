import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const runtimeRoot = path.join(workspaceRoot, ".docker-runtime");

function ensureRuntimeRoot() {
  mkdirSync(runtimeRoot, { recursive: true });
}

function requirePath(relativePath) {
  const absolutePath = path.join(workspaceRoot, relativePath);

  if (!existsSync(absolutePath)) {
    throw new Error(`Required runtime asset is missing: ${relativePath}`);
  }

  return absolutePath;
}

function copyIntoRuntime(sourceRelativePath, targetRelativePath = sourceRelativePath) {
  const sourcePath = requirePath(sourceRelativePath);
  const targetPath = path.join(runtimeRoot, targetRelativePath);
  const sourceStat = statSync(sourcePath);

  rmSync(targetPath, { recursive: true, force: true });
  mkdirSync(path.dirname(targetPath), { recursive: true });

  if (!sourceStat.isDirectory()) {
    cpSync(sourcePath, targetPath);
    return;
  }

  mkdirSync(targetPath, { recursive: true });

  for (const entry of readdirSync(sourcePath)) {
    cpSync(path.join(sourcePath, entry), path.join(targetPath, entry), { recursive: true });
  }
}

ensureRuntimeRoot();

copyIntoRuntime(".next/standalone", "standalone");
copyIntoRuntime(".next/static", "static");

if (existsSync(path.join(workspaceRoot, "public"))) {
  copyIntoRuntime("public");
}

copyIntoRuntime("db");
copyIntoRuntime("scripts");
copyIntoRuntime("drizzle.config.mjs");
