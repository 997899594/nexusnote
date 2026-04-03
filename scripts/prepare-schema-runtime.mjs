import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
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

function copyEsbuildPlatformPackages() {
  const scopedDirectory = path.join(nodeModulesRoot, "@esbuild");
  if (!existsSync(scopedDirectory)) {
    return;
  }

  for (const packageName of readdirSync(scopedDirectory)) {
    copyPackage(`@esbuild/${packageName}`);
  }
}

rmSync(runtimeNodeModulesRoot, { force: true, recursive: true });
mkdirSync(runtimeNodeModulesRoot, { recursive: true });

for (const packageName of runtimePackages) {
  copyPackage(packageName);
}

copyEsbuildPlatformPackages();
