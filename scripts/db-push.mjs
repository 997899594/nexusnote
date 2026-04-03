import { spawnSync } from "node:child_process";
import { ensurePgvector, verifyCurrentSchema } from "./db-verify.mjs";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

function runCommand(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: process.env,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status ?? 1}`);
  }
}

await ensurePgvector(connectionString);
runCommand("node", [
  "./node_modules/drizzle-kit/bin.cjs",
  "push",
  "--config",
  "drizzle.config.mjs",
  "--force",
]);
await verifyCurrentSchema(connectionString);
