import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";

const workspaceRoot = process.cwd();
const nodeModulesRoot = path.join(workspaceRoot, "node_modules");
const runtimeNodeModulesRoot = path.join(workspaceRoot, ".docker-runtime", "node_modules");

const runtimePackages = ["drizzle-kit", "drizzle-orm", "esbuild", "postgres"];

function packageExists(packageName) {
  return existsSync(path.join(nodeModulesRoot, packageName));
}

function copyPackage(packageName) {
  if (!packageExists(packageName)) {
    return;
  }

  const segments = packageName.split("/");
  const targetDirectory =
    segments.length > 1
      ? path.join(runtimeNodeModulesRoot, ...segments.slice(0, -1))
      : runtimeNodeModulesRoot;

  mkdirSync(targetDirectory, { recursive: true });
  cpSync(path.join(nodeModulesRoot, packageName), path.join(runtimeNodeModulesRoot, packageName), {
    recursive: true,
  });
}

function resolveEsbuildPlatformPackage(platform, arch) {
  if (platform === "linux" && arch === "x64") {
    return "@esbuild/linux-x64";
  }

  if (platform === "linux" && arch === "arm64") {
    return "@esbuild/linux-arm64";
  }

  if (platform === "darwin" && arch === "arm64") {
    return "@esbuild/darwin-arm64";
  }

  if (platform === "darwin" && arch === "x64") {
    return "@esbuild/darwin-x64";
  }

  return null;
}

rmSync(runtimeNodeModulesRoot, { force: true, recursive: true });
mkdirSync(runtimeNodeModulesRoot, { recursive: true });

for (const packageName of runtimePackages) {
  copyPackage(packageName);
}

for (const packageName of new Set([
  "@esbuild/linux-x64",
  resolveEsbuildPlatformPackage(process.platform, process.arch),
])) {
  if (packageName) {
    copyPackage(packageName);
  }
}
