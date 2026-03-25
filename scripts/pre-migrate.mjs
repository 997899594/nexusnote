import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

const sql = postgres(connectionString, {
  max: 1,
  prepare: false,
});

try {
  // pgvector must exist before Drizzle applies vector columns and indexes.
  await sql`CREATE EXTENSION IF NOT EXISTS vector;`;
} finally {
  await sql.end({ timeout: 5 });
}
