import { readMigrationFiles } from "drizzle-orm/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const migrations = readMigrationFiles({
  migrationsFolder: "drizzle",
});

async function ensureMigrationBaseline() {
  const sql = postgres(connectionString, {
    max: 1,
    prepare: false,
  });

  try {
    const [migrationTableRow] = await sql`
      SELECT to_regclass('drizzle.__drizzle_migrations') AS migration_table
    `;

    const applicationTables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('users', 'notes', 'tags')
    `;

    if (applicationTables.length === 0) {
      return;
    }

    if (!migrationTableRow?.migration_table) {
      await sql`CREATE SCHEMA IF NOT EXISTS drizzle`;
      await sql`
        CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
          id SERIAL PRIMARY KEY,
          hash text NOT NULL,
          created_at bigint
        )
      `;
    }

    const [appliedRows] = await sql`
      SELECT COUNT(*)::int AS count
      FROM drizzle.__drizzle_migrations
    `;

    if ((appliedRows?.count ?? 0) > 0) {
      return;
    }

    for (const migration of migrations) {
      await sql`
        INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
        VALUES (${migration.hash}, ${migration.folderMillis})
      `;
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function verifyDatabaseState() {
  const sql = postgres(connectionString, {
    max: 1,
    prepare: false,
  });

  try {
    const extensionRows = await sql`
      SELECT extname
      FROM pg_extension
      WHERE extname = 'vector'
    `;

    if (extensionRows.length === 0) {
      throw new Error("pgvector extension is missing after migration");
    }

    const requiredTables = ["users", "notes", "tags"];
    const tableRows = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ANY(${requiredTables})
    `;

    const tableNames = new Set(tableRows.map((row) => row.table_name));
    for (const table of requiredTables) {
      if (!tableNames.has(table)) {
        throw new Error(`required table ${table} is missing after migration`);
      }
    }

    const vectorColumnRows = await sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'tags'
        AND column_name = 'name_embedding'
    `;

    if (vectorColumnRows.length === 0) {
      throw new Error("tags.name_embedding is missing after migration");
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

await import("./pre-migrate.mjs");
await ensureMigrationBaseline();

const migrationClient = postgres(connectionString, {
  max: 1,
  prepare: false,
});

try {
  const db = drizzle(migrationClient);
  await migrate(db, {
    migrationsFolder: "drizzle",
  });
} finally {
  await migrationClient.end({ timeout: 5 });
}

await verifyDatabaseState();
