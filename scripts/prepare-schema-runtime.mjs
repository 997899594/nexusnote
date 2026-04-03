import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";

const workspaceRoot = process.cwd();
const nodeModulesRoot = path.join(workspaceRoot, "node_modules");
const runtimeNodeModulesRoot = path.join(workspaceRoot, ".docker-runtime", "node_modules");

const rootPackages = ["drizzle-kit", "drizzle-orm", "postgres"];
const copiedPackages = new Set();
const queue = [...rootPackages];

function readPackageJson(packageName) {
  return JSON.parse(readFileSync(path.join(nodeModulesRoot, packageName, "package.json"), "utf8"));
}

function packageExists(packageName) {
  return existsSync(path.join(nodeModulesRoot, packageName));
}

function enqueueDependencies(packageJson) {
  for (const dependencyName of Object.keys(packageJson.dependencies ?? {})) {
    if (!copiedPackages.has(dependencyName) && packageExists(dependencyName)) {
      queue.push(dependencyName);
    }
  }
}

rmSync(runtimeNodeModulesRoot, { force: true, recursive: true });
mkdirSync(runtimeNodeModulesRoot, { recursive: true });

while (queue.length > 0) {
  const packageName = queue.shift();
  if (!packageName || copiedPackages.has(packageName) || !packageExists(packageName)) {
    continue;
  }

  copiedPackages.add(packageName);

  cpSync(path.join(nodeModulesRoot, packageName), path.join(runtimeNodeModulesRoot, packageName), {
    recursive: true,
  });

  enqueueDependencies(readPackageJson(packageName));
}
