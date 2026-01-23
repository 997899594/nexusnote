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
    console.log('[Migrate] Installing pgvector extension...')
    try {
      await migrationClient`CREATE EXTENSION IF NOT EXISTS vector`

      // Check pgvector version
      const extResult = await migrationClient`
        SELECT extversion FROM pg_extension WHERE extname = 'vector'
      `
      
      if (extResult.length === 0) {
        throw new Error('pgvector extension not found after installation')
      }

      const pgvectorVersion = extResult[0]?.extversion || 'unknown'
      console.log('[Migrate] ✓ pgvector extension installed (version:', pgvectorVersion + ')')

      // halfvec requires pgvector 0.5.0+
      if (pgvectorVersion && pgvectorVersion < '0.5.0') {
        console.error('')
        console.error('╔════════════════════════════════════════════════════════════════╗')
        console.error('║  pgvector 版本过低                                              ║')
        console.error('╠════════════════════════════════════════════════════════════════╣')
        console.error(`║  当前版本: ${pgvectorVersion.padEnd(50)} ║`)
        console.error('║  需要版本: 0.5.0+                                               ║')
        console.error('║                                                                 ║')
        console.error('║  halfvec 类型需要 pgvector 0.5.0 或更高版本                     ║')
        console.error('╠════════════════════════════════════════════════════════════════╣')
        console.error('║  解决方案：                                                     ║')
        console.error('║  1. 升级 pgvector 扩展到 0.5.0+                                 ║')
        console.error('║  2. 使用支持最新 pgvector 的数据库服务：                        ║')
        console.error('║     - Supabase (免费，pgvector 0.7+)                            ║')
        console.error('║     - Neon (免费，pgvector 0.7+)                                ║')
        console.error('║     - Railway (pgvector 0.7+)                                   ║')
        console.error('╚════════════════════════════════════════════════════════════════╝')
        console.error('')
        throw new Error(`pgvector ${pgvectorVersion} does not support halfvec type (requires 0.5.0+)`)
      }

      console.log('[Migrate] ✓ pgvector version check passed')

    } catch (extError: any) {
      console.error('')
      console.error('╔════════════════════════════════════════════════════════════════╗')
      console.error('║  pgvector 扩展安装失败                                          ║')
      console.error('╠════════════════════════════════════════════════════════════════╣')
      console.error(`║  错误: ${(extError.message || 'Unknown error').substring(0, 54).padEnd(54)} ║`)
      console.error(`║  代码: ${(extError.code || 'N/A').padEnd(54)} ║`)
      console.error('╠════════════════════════════════════════════════════════════════╣')
      console.error('║  可能原因：                                                     ║')
      console.error('║  1. 数据库不支持 pgvector 扩展                                  ║')
      console.error('║  2. 没有安装权限（需要 SUPERUSER 或 rds_superuser）             ║')
      console.error('║  3. PostgreSQL 版本过低（需要 12+）                             ║')
      console.error('╠════════════════════════════════════════════════════════════════╣')
      console.error('║  解决方案：                                                     ║')
      console.error('║                                                                 ║')
      console.error('║  【推荐】使用支持 pgvector 的免费数据库：                       ║')
      console.error('║  • Supabase: https://supabase.com (免费 500MB)                  ║')
      console.error('║    - 自带 pgvector 0.7+                                         ║')
      console.error('║    - 无需手动安装                                               ║')
      console.error('║                                                                 ║')
      console.error('║  • Neon: https://neon.tech (免费 3GB)                           ║')
      console.error('║    - 支持 pgvector                                              ║')
      console.error('║    - Serverless PostgreSQL                                      ║')
      console.error('║                                                                 ║')
      console.error('║  Render 用户：                                                  ║')
      console.error('║  - 免费版不支持扩展                                             ║')
      console.error('║  - 需要升级到 $7/月 Starter 计划                                ║')
      console.error('║                                                                 ║')
      console.error('║  自建数据库：                                                   ║')
      console.error('║  1. 使用 pgvector Docker 镜像：                                 ║')
      console.error('║     docker run -d pgvector/pgvector:pg16                        ║')
      console.error('║  2. 或手动安装：                                                ║')
      console.error('║     https://github.com/pgvector/pgvector#installation           ║')
      console.error('╚════════════════════════════════════════════════════════════════╝')
      console.error('')
      throw new Error('pgvector extension is required but not available')
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
