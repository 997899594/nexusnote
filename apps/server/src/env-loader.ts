import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

// Load .env from monorepo root
// Path: apps/server/src/env-loader.ts -> ../../../.env -> root/.env
const envPath = path.resolve(__dirname, "../../../.env");

// Verify file exists to provide better error message
if (fs.existsSync(envPath)) {
  console.log(`[env-loader] Loading environment from ${envPath}`);
  const result = dotenv.config({ path: envPath });

  if (result.error) {
    console.warn(
      `[env-loader] Failed to parse .env file: ${result.error.message}`,
    );
  } else {
    console.log(`[env-loader] Environment loaded successfully.`);
  }
} else {
  console.warn(`[env-loader] .env file not found at ${envPath}`);
  // Try one level up just in case (e.g. if structure changes)
  const altPath = path.resolve(__dirname, "../../../../.env");
  if (fs.existsSync(altPath)) {
    console.log(`[env-loader] Found .env at alternative path: ${altPath}`);
    dotenv.config({ path: altPath });
  }
}
