import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { ensurePgvector, verifyCurrentSchema } from "./db-verify.mjs";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const drizzleJournalPath = path.resolve(__dirname, "../drizzle/meta/_journal.json");

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

async function loadDrizzleJournalEntries() {
  const journalRaw = await readFile(drizzleJournalPath, "utf8");
  const journal = JSON.parse(journalRaw);
  const entries = Array.isArray(journal?.entries) ? journal.entries : [];

  return entries
    .map((entry) => ({
      tag: typeof entry?.tag === "string" ? entry.tag : "",
      when: Number(entry?.when),
    }))
    .filter((entry) => entry.tag.length > 0 && Number.isFinite(entry.when));
}

async function seedLegacyBaselineIfNeeded(journalEntries) {
  if (journalEntries.length === 0) {
    return;
  }

  const sql = postgres(connectionString, {
    max: 1,
    prepare: false,
  });

  try {
    await sql`CREATE SCHEMA IF NOT EXISTS "drizzle";`;
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
        id serial PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      );
    `);

    const [row] = await sql`SELECT count(*)::int AS count FROM "drizzle"."__drizzle_migrations";`;
    const appliedCount = Number(row?.count ?? 0);

    if (appliedCount > 0) {
      return;
    }

    const [legacyRow] = await sql`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'users'
      ) AS "hasLegacySchema";
    `;

    if (!legacyRow?.hasLegacySchema) {
      return;
    }

    for (const entry of journalEntries) {
      await sql`
        INSERT INTO "drizzle"."__drizzle_migrations" ("hash", "created_at")
        VALUES (${entry.tag}, ${entry.when})
      `;
    }

    console.warn(`[db:migrate] baseline-adopted ${journalEntries.length} migration entries`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

await ensurePgvector(connectionString);
const journalEntries = await loadDrizzleJournalEntries();
await seedLegacyBaselineIfNeeded(journalEntries);

runCommand("node", [
  "./node_modules/drizzle-kit/bin.cjs",
  "migrate",
  "--config",
  "drizzle.config.mjs",
]);

await verifyCurrentSchema(connectionString);
