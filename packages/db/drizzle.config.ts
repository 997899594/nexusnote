import * as dotenv from "dotenv";
import path from "path";

// Manually load .env from monorepo root
// This is required because drizzle-kit runs in the package context, not app context
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import { env } from "@nexusnote/config";
import type { Config } from "drizzle-kit";

export default {
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: env.DATABASE_URL,
  },
} satisfies Config;
