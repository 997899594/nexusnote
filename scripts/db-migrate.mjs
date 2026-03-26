import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
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
