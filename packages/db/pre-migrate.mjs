/**
 * Pre-migration script
 * Workaround for Drizzle customType quoting bug:
 * drizzle-kit push generates "halfvec(4000)" (quoted) which PostgreSQL rejects.
 * This script creates the pgvector extension and pre-creates tables with halfvec columns
 * using raw SQL, so drizzle-kit push can handle the rest.
 */
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL);

try {
  // 1. Create pgvector extension
  await sql`CREATE EXTENSION IF NOT EXISTS vector`;
  console.log("[pre-migrate] pgvector extension ready");

  // 2. Pre-create tables with halfvec columns (CREATE IF NOT EXISTS)
  // These must match the schema.ts definitions for the halfvec columns.
  // drizzle-kit push will add missing columns/indexes/constraints afterwards.
  const dim = process.env.EMBEDDING_DIMENSIONS || 4000;

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS document_chunks (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      document_id uuid,
      content text NOT NULL,
      embedding halfvec(${dim}),
      chunk_index integer NOT NULL,
      created_at timestamp DEFAULT now()
    )
  `);

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS topics (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid,
      name text NOT NULL,
      embedding halfvec(${dim}),
      note_count integer DEFAULT 0,
      last_active_at timestamp DEFAULT now(),
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now()
    )
  `);

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS extracted_notes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid,
      content text NOT NULL,
      embedding halfvec(${dim}),
      source_type text NOT NULL,
      source_document_id uuid,
      source_chapter_id uuid,
      source_position jsonb,
      topic_id uuid,
      status text DEFAULT 'processing',
      created_at timestamp DEFAULT now()
    )
  `);

  console.log("[pre-migrate] halfvec tables pre-created");
} catch (err) {
  console.error("[pre-migrate] failed:", err.message);
  process.exit(1);
} finally {
  await sql.end();
}
