import { env } from "@/config/env";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

// We rely on @nexusnote/config or the application entry point to load env vars
// This keeps the db package pure and avoids duplicate dotenv loading

// Prevent execution on client side to avoid accessing ServerEnv
const isServer = typeof window === "undefined";

const connectionString = isServer ? env.DATABASE_URL : "";

// Use a global variable to store the connection in development
// to prevent multiple connections during hot reloading
const globalForDb = globalThis as unknown as {
  conn: postgres.Sql | undefined;
};

// Initialize client only on server
const client = isServer
  ? (globalForDb.conn ?? postgres(connectionString))
  : (null as unknown as postgres.Sql);

if (isServer && env.NODE_ENV !== "production") {
  globalForDb.conn = client;
}

export const db = isServer
  ? drizzle(client, { schema })
  : (null as unknown as ReturnType<typeof drizzle<typeof schema>>);

// Re-export common drizzle-orm operators for consistency
export {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  type InferInsertModel,
  type InferSelectModel,
  inArray,
  lt,
  lte,
  ne,
  notInArray,
  or,
  sql,
} from "drizzle-orm";
// Re-export drizzle function for creating database instances
export { drizzle } from "drizzle-orm/postgres-js";
export * from "./schema.js";
