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
    // Check PostgreSQL version
    const versionResult = await migrationClient`SELECT version()`
    console.log('[Migrate] PostgreSQL:', versionResult[0]?.version?.split(',')[0])

    // Check available extensions
    console.log('[Migrate] Checking available extensions...')
    const availableExts = await migrationClient`
      SELECT name, default_version FROM pg_available_extensions
      WHERE name IN ('vector', 'pgvector')
    `
    console.log('[Migrate] Available vector extensions:', JSON.stringify(availableExts))

    // Check installed extensions
    const installedExts = await migrationClient`
      SELECT extname, extversion FROM pg_extension
    `
    console.log('[Migrate] Installed extensions:', installedExts.map(e => `${e.extname}@${e.extversion}`).join(', '))

    // Enable pgvector extension first (if not exists)
    console.log('[Migrate] Ensuring pgvector extension...')
    try {
      await migrationClient`CREATE EXTENSION IF NOT EXISTS vector`

      // Check pgvector version
      const extResult = await migrationClient`
        SELECT extversion FROM pg_extension WHERE extname = 'vector'
      `
      const pgvectorVersion = extResult[0]?.extversion || 'unknown'
      console.log('[Migrate] ✓ pgvector extension ready (version:', pgvectorVersion + ')')

      // halfvec requires pgvector 0.5.0+
      if (pgvectorVersion && pgvectorVersion < '0.5.0') {
        console.error('[Migrate] ❌ pgvector version', pgvectorVersion, '< 0.5.0, halfvec type NOT available!')
        console.error('[Migrate] Please upgrade pgvector to 0.5.0+ or use a database that supports it')
        throw new Error(`pgvector ${pgvectorVersion} does not support halfvec type (requires 0.5.0+)`)
      }
    } catch (extError: any) {
      console.error('[Migrate] ❌ Failed to create pgvector extension:', extError.message)
      console.error('[Migrate] Error code:', extError.code)
      throw extError
    }

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
