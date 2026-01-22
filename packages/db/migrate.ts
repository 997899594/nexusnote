/**
 * Database Migration Script
 *
 * 运行方式: npx tsx migrate.ts
 * 或在 Render buildCommand 中执行
 */

import postgres from 'postgres'
import * as fs from 'fs'
import * as path from 'path'

const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
  console.error('DATABASE_URL not set')
  process.exit(1)
}

const client = postgres(DATABASE_URL)

async function runMigrations() {
  console.log('[Migrate] Starting migrations...')

  const migrationsDir = path.join(__dirname, 'migrations')
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort()

  for (const file of files) {
    const filePath = path.join(migrationsDir, file)
    const sql = fs.readFileSync(filePath, 'utf-8')

    console.log(`[Migrate] Running: ${file}`)

    try {
      // Split by semicolons and run each statement
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'))

      for (const statement of statements) {
        await client.unsafe(statement)
      }

      console.log(`[Migrate] ✓ ${file}`)
    } catch (error: any) {
      // Ignore "already exists" errors for idempotent migrations
      if (error.message?.includes('already exists') ||
          error.message?.includes('duplicate key')) {
        console.log(`[Migrate] ✓ ${file} (already applied)`)
      } else {
        console.error(`[Migrate] ✗ ${file}:`, error.message)
        throw error
      }
    }
  }

  console.log('[Migrate] All migrations complete!')
  await client.end()
}

runMigrations().catch((error) => {
  console.error('[Migrate] Failed:', error)
  process.exit(1)
})
