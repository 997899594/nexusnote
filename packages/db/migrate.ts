/**
 * Database Migration Script
 *
 * Uses drizzle-orm's native migration system for proper version tracking.
 *
 * Usage:
 *   pnpm --filter @nexusnote/db migrate
 *
 * Workflow:
 *   1. Modify src/schema.ts
 *   2. Run: pnpm --filter @nexusnote/db generate
 *   3. Review generated SQL in drizzle/
 *   4. Run: pnpm --filter @nexusnote/db migrate
 */

import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set')
  process.exit(1)
}

async function runMigrations() {
  console.log('[Migrate] Starting database migrations...')
  console.log(`[Migrate] Database: ${DATABASE_URL!.replace(/\/\/[^@]+@/, '//***@')}`)

  // Use a separate connection for migrations
  const migrationClient = postgres(DATABASE_URL!, { max: 1 })
  const db = drizzle(migrationClient)

  try {
    // Enable pgvector extension first (if not exists)
    console.log('[Migrate] Ensuring pgvector extension...')
    await migrationClient`CREATE EXTENSION IF NOT EXISTS vector`
    console.log('[Migrate] ✓ pgvector extension ready')

    // Run drizzle migrations
    console.log('[Migrate] Running schema migrations...')
    await migrate(db, { migrationsFolder: './drizzle' })
    console.log('[Migrate] ✓ All migrations applied successfully')

  } catch (error) {
    console.error('[Migrate] ❌ Migration failed:', error)
    throw error
  } finally {
    await migrationClient.end()
  }
}

runMigrations()
  .then(() => {
    console.log('[Migrate] Done!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('[Migrate] Fatal error:', error)
    process.exit(1)
  })
