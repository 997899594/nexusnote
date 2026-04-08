import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const cwd = process.cwd();
const serverEntrypoint = path.join(cwd, "server.js");
const nextCliEntrypoint = path.join(cwd, "node_modules", "next", "dist", "bin", "next");
const extraArgs = process.argv.slice(2);

const commandArgs = existsSync(serverEntrypoint)
  ? [serverEntrypoint, ...extraArgs]
  : [nextCliEntrypoint, "start", ...extraArgs];

const child = spawn(process.execPath, commandArgs, {
  cwd,
  env: process.env,
  stdio: "inherit",
});

child.on("error", (error) => {
  console.error(error);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
